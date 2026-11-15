import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { requireAuth, requireRole, AuthRequest } from "./middleware/auth";

const app = express();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const JWT_EXPIRES = "24h";

// ── Middleware ────────────────────────────────────────────
app.use(cors({ origin: ["http://localhost:5173", "http://localhost:5174"], credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ═════════════════════════════════════════════════════════
// AUTH ROUTES
// ═════════════════════════════════════════════════════════

// POST /api/auth/login
// Validates credentials and issues a JWT in an HTTP-only cookie.
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password required", code: "MISSING_FIELDS" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: "Invalid credentials", code: "INVALID_CREDENTIALS" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials", code: "INVALID_CREDENTIALS" });
    return;
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  res.cookie("token", token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
  res.status(200).json({ user: { id: user.id, email: user.email, role: user.role } });
});

// POST /api/auth/logout
// Clears the JWT cookie.
app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("token");
  res.status(200).json({ message: "Logged out" });
});

// GET /api/auth/me
// Returns the current authenticated user.
app.get("/api/auth/me", requireAuth, (req: AuthRequest, res) => {
  res.status(200).json(req.user);
});

// ═════════════════════════════════════════════════════════
// PUBLIC BOARD (no auth required)
// ═════════════════════════════════════════════════════════

// GET /api/board
// Returns all counters with their current serving number.
// Accessible without login (FR-07).
app.get("/api/board", async (_req, res) => {
  try {
    const counters = await prisma.counter.findMany({
      select: { id: true, name: true, status: true, currentServing: true },
      orderBy: { id: "asc" },
    });
    res.status(200).json({ counters });
  } catch (error) {
    console.error("Board fetch failed:", error);
    res.status(500).json({ error: "Failed to fetch board data" });
  }
});

// GET /api/counters/my-counter
// Resolve ownership from the verified session, never a client-supplied ID.
app.get(
  "/api/counters/my-counter",
  requireAuth,
  requireRole("OPERATOR"),
  async (req: AuthRequest, res) => {
    try {
      const counter = await prisma.counter.findUnique({
        where: { operatorId: req.user!.id },
        select: { id: true, name: true, status: true, currentServing: true },
      });
      if (!counter) {
        res.status(404).json({ error: "No counter assigned", code: "NO_ASSIGNED_COUNTER" });
        return;
      }
      res.status(200).json({ counter });
    } catch (error) {
      console.error("Operator counter fetch failed:", error);
      res.status(500).json({ error: "Failed to load your counter", code: "COUNTER_LOAD_FAILED" });
    }
  }
);

// ═════════════════════════════════════════════════════════
// QUEUE ROUTES — Customer only
// ═════════════════════════════════════════════════════════

// POST /api/queues/join
// Customer joins an open counter queue (FR-01).
// Business rules enforced:
//   BR-01 — no duplicate active ticket for the same counter
//   BR-02 — counter must be OPEN
app.post(
  "/api/queues/join",
  requireAuth,
  requireRole("CUSTOMER"),
  async (req: AuthRequest, res) => {
    const { counter_id } = req.body as { counter_id?: number };
    const customerId = req.user!.id;

    if (!counter_id) {
      res.status(400).json({ error: "counter_id is required", code: "MISSING_FIELDS" });
      return;
    }

    try {
      // BR-02: Counter must exist and be OPEN
      const counter = await prisma.counter.findUnique({ where: { id: counter_id } });
      if (!counter) {
        res.status(404).json({ error: "Counter not found", code: "COUNTER_NOT_FOUND" });
        return;
      }
      if (counter.status === "CLOSED") {
        res.status(400).json({ error: "Counter is closed", code: "COUNTER_CLOSED" });
        return;
      }

      // BR-01 & Concurrency protection: Atomic transaction for duplicate check & queue allocation
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.queueTicket.findFirst({
          where: {
            customerId,
            counterId: counter_id,
            status: { in: ["WAITING", "IN_SERVICE"] },
          },
        });
        if (existing) {
          return { error: "DUPLICATE_TICKET" as const };
        }

        const last = await tx.queueTicket.findFirst({
          where: { counterId: counter_id },
          orderBy: { queueNumber: "desc" },
        });
        const queueNumber = (last?.queueNumber ?? 0) + 1;

        const ticket = await tx.queueTicket.create({
          data: { queueNumber, status: "WAITING", customerId, counterId: counter_id },
        });

        return { ticket };
      });

      if ("error" in result && result.error === "DUPLICATE_TICKET") {
        res.status(400).json({
          error: "You already have an active ticket for this queue",
          code: "DUPLICATE_TICKET",
        });
        return;
      }

      res.status(201).json({ ticket: result.ticket });
    } catch (error) {
      console.error("Join queue failed:", error);
      res.status(500).json({ error: "Failed to join queue" });
    }
  }
);

// GET /api/queues/my-ticket
// Customer views their active ticket and queue position (FR-02).
// Returns single ticket + position (for AC-09) AND all active tickets (for AC-07b).
app.get(
  "/api/queues/my-ticket",
  requireAuth,
  requireRole("CUSTOMER"),
  async (req: AuthRequest, res) => {
    const customerId = req.user!.id;

    try {
      const allActive = await prisma.queueTicket.findMany({
        where: { customerId, status: { in: ["WAITING", "IN_SERVICE"] } },
        include: { counter: { select: { id: true, name: true, currentServing: true } } },
        orderBy: { createdAt: "asc" },
      });

      if (allActive.length === 0) {
        res.status(404).json({ error: "No active ticket", code: "NO_ACTIVE_TICKET" });
        return;
      }

      // Compute position for each active ticket
      const ticketsWithPosition = await Promise.all(
        allActive.map(async (t) => {
          const pos = await prisma.queueTicket.count({
            where: {
              counterId: t.counterId,
              status: "WAITING",
              queueNumber: { lt: t.queueNumber },
            },
          });
          return { ticket: t, position: pos };
        })
      );

      // Primary ticket is either specified via ?counter_id= or the first active ticket
      const counterIdQuery = req.query.counter_id ? Number(req.query.counter_id) : undefined;
      const primary = counterIdQuery
        ? ticketsWithPosition.find((tp) => tp.ticket.counterId === counterIdQuery) ?? ticketsWithPosition[0]
        : ticketsWithPosition[0];

      res.status(200).json({
        ticket: primary.ticket,
        position: primary.position,
        tickets: ticketsWithPosition,
      });
    } catch (error) {
      console.error("View ticket failed:", error);
      res.status(500).json({ error: "Failed to fetch ticket" });
    }
  }
);

// DELETE /api/queues/my-ticket
// Customer cancels their active WAITING ticket (FR-03).
app.delete(
  "/api/queues/my-ticket",
  requireAuth,
  requireRole("CUSTOMER"),
  async (req: AuthRequest, res) => {
    const customerId = req.user!.id;
    const counterId = req.query.counter_id
      ? Number(req.query.counter_id)
      : req.body?.counter_id
      ? Number(req.body.counter_id)
      : undefined;
    const ticketId = req.query.ticket_id
      ? Number(req.query.ticket_id)
      : req.body?.ticket_id
      ? Number(req.body.ticket_id)
      : undefined;

    try {
      const whereClause: {
        customerId: number;
        status: { in: ["WAITING", "IN_SERVICE"] };
        id?: number;
        counterId?: number;
      } = {
        customerId,
        status: { in: ["WAITING", "IN_SERVICE"] },
      };
      if (ticketId) {
        whereClause.id = ticketId;
      } else if (counterId) {
        whereClause.counterId = counterId;
      }

      const ticket = await prisma.queueTicket.findFirst({
        where: whereClause,
      });

      if (!ticket) {
        res.status(404).json({ error: "No active ticket", code: "NO_ACTIVE_TICKET" });
        return;
      }

      if (ticket.status === "IN_SERVICE") {
        res.status(400).json({
          error: "Cannot cancel a ticket that is in service",
          code: "TICKET_IN_SERVICE",
        });
        return;
      }

      await prisma.queueTicket.update({
        where: { id: ticket.id },
        data: { status: "CANCELLED" },
      });

      res.status(200).json({ message: "Ticket cancelled" });
    } catch (error) {
      console.error("Cancel ticket failed:", error);
      res.status(500).json({ error: "Failed to cancel ticket" });
    }
  }
);

// ═════════════════════════════════════════════════════════
// COUNTER ROUTES — Operator only
// ═════════════════════════════════════════════════════════

// PATCH /api/counters/:id/status
// Operator opens or closes their assigned counter (FR-06).
// BR-04: Operator can only act on their own counter.
app.patch(
  "/api/counters/:id/status",
  requireAuth,
  requireRole("OPERATOR"),
  async (req: AuthRequest, res) => {
    const counterId = parseInt(req.params.id);
    const operatorId = req.user!.id;
    const { status } = req.body as { status?: string };

    if (status !== "OPEN" && status !== "CLOSED") {
      res.status(400).json({ error: "status must be OPEN or CLOSED", code: "INVALID_STATUS" });
      return;
    }

    try {
      const counter = await prisma.counter.findUnique({ where: { id: counterId } });
      if (!counter) {
        res.status(404).json({ error: "Counter not found", code: "COUNTER_NOT_FOUND" });
        return;
      }

      // BR-04: Operator ownership
      if (counter.operatorId !== operatorId) {
        res.status(403).json({ error: "Not your counter", code: "FORBIDDEN" });
        return;
      }

      const updated = await prisma.counter.update({
        where: { id: counterId },
        data: { status },
      });

      res.status(200).json({ counter: { id: updated.id, status: updated.status } });
    } catch (error) {
      console.error("Update counter status failed:", error);
      res.status(500).json({ error: "Failed to update counter status" });
    }
  }
);

// POST /api/counters/:id/next
// Operator calls the next customer in queue (FR-04).
// Business rules enforced:
//   BR-03 — cannot call next while a customer is IN_SERVICE
//   BR-04 — operator can only act on their own counter
app.post(
  "/api/counters/:id/next",
  requireAuth,
  requireRole("OPERATOR"),
  async (req: AuthRequest, res) => {
    const counterId = parseInt(req.params.id);
    const operatorId = req.user!.id;

    try {
      const counter = await prisma.counter.findUnique({ where: { id: counterId } });
      if (!counter) {
        res.status(404).json({ error: "Counter not found", code: "COUNTER_NOT_FOUND" });
        return;
      }

      // BR-04
      if (counter.operatorId !== operatorId) {
        res.status(403).json({ error: "Not your counter", code: "FORBIDDEN" });
        return;
      }

      // BR-03: Cannot call next while one is IN_SERVICE
      const inService = await prisma.queueTicket.findFirst({
        where: { counterId, status: "IN_SERVICE" },
      });
      if (inService) {
        res.status(400).json({
          error: "Current customer not yet served",
          code: "CUSTOMER_IN_SERVICE",
        });
        return;
      }

      // Get the next WAITING ticket (lowest queue number)
      const nextTicket = await prisma.queueTicket.findFirst({
        where: { counterId, status: "WAITING" },
        orderBy: { queueNumber: "asc" },
      });
      if (!nextTicket) {
        res.status(404).json({ error: "No waiting customers", code: "QUEUE_EMPTY" });
        return;
      }

      // Atomically: advance serving number + mark ticket IN_SERVICE
      const [updatedTicket] = await prisma.$transaction([
        prisma.queueTicket.update({
          where: { id: nextTicket.id },
          data: { status: "IN_SERVICE" },
        }),
        prisma.counter.update({
          where: { id: counterId },
          data: { currentServing: nextTicket.queueNumber },
        }),
      ]);

      res.status(200).json({ ticket: updatedTicket });
    } catch (error) {
      console.error("Call next failed:", error);
      res.status(500).json({ error: "Failed to call next customer" });
    }
  }
);

// POST /api/counters/:id/serve
// Operator marks the current IN_SERVICE customer as served (FR-05).
// BR-04: Operator can only act on their own counter.
app.post(
  "/api/counters/:id/serve",
  requireAuth,
  requireRole("OPERATOR"),
  async (req: AuthRequest, res) => {
    const counterId = parseInt(req.params.id);
    const operatorId = req.user!.id;

    try {
      const counter = await prisma.counter.findUnique({ where: { id: counterId } });
      if (!counter) {
        res.status(404).json({ error: "Counter not found", code: "COUNTER_NOT_FOUND" });
        return;
      }

      // BR-04
      if (counter.operatorId !== operatorId) {
        res.status(403).json({ error: "Not your counter", code: "FORBIDDEN" });
        return;
      }

      const inServiceTicket = await prisma.queueTicket.findFirst({
        where: { counterId, status: "IN_SERVICE" },
      });
      if (!inServiceTicket) {
        res.status(404).json({ error: "No customer in service", code: "NO_IN_SERVICE" });
        return;
      }

      const updated = await prisma.queueTicket.update({
        where: { id: inServiceTicket.id },
        data: { status: "SERVED" },
      });

      res.status(200).json({ ticket: { id: updated.id, status: updated.status } });
    } catch (error) {
      console.error("Mark served failed:", error);
      res.status(500).json({ error: "Failed to mark customer as served" });
    }
  }
);

export { app, prisma };

