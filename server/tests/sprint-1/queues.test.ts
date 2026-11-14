import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { app, prisma } from "../../src/app";

// ─────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────
let customerCookie: string;
let customer2Cookie: string;
let counterId: number;

beforeAll(async () => {
  // Login customer1
  const res1 = await request(app)
    .post("/api/auth/login")
    .send({ email: "customer1@test.com", password: "password123" });
  customerCookie = res1.headers["set-cookie"]?.[0] ?? "";

  // Login customer2
  const res2 = await request(app)
    .post("/api/auth/login")
    .send({ email: "customer2@test.com", password: "password123" });
  customer2Cookie = res2.headers["set-cookie"]?.[0] ?? "";

  // Login operator1 and open counter A
  const opRes = await request(app)
    .post("/api/auth/login")
    .send({ email: "operator1@test.com", password: "password123" });
  const opCookie = opRes.headers["set-cookie"]?.[0] ?? "";

  // Find counter A
  const boardRes = await request(app).get("/api/board");
  const counterA = boardRes.body.counters.find((c: { name: string }) => c.name === "Counter A");
  counterId = counterA?.id ?? 1;

  // Open the counter so customers can join
  await request(app)
    .patch(`/api/counters/${counterId}/status`)
    .set("Cookie", opCookie)
    .send({ status: "OPEN" });
});

// Clean up tickets between tests to avoid state leaking
beforeEach(async () => {
  await prisma.queueTicket.deleteMany({});
  // Reset currentServing to 0
  await prisma.counter.updateMany({ data: { currentServing: 0 } });
});

afterAll(async () => {
  await prisma.queueTicket.deleteMany({});
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────
// TEST-06 / AC-06: Customer joins an open counter
// ─────────────────────────────────────────────────────────
describe("TEST-06: POST /api/queues/join — happy path", () => {
  it("returns HTTP 201 with a WAITING ticket", async () => {
    const res = await request(app)
      .post("/api/queues/join")
      .set("Cookie", customerCookie)
      .send({ counter_id: counterId });

    expect(res.status).toBe(201);
    expect(res.body.ticket.status).toBe("WAITING");
    expect(res.body.ticket.queueNumber).toBeGreaterThan(0);
  });

  it("persists the ticket in the database", async () => {
    await request(app)
      .post("/api/queues/join")
      .set("Cookie", customerCookie)
      .send({ counter_id: counterId });

    const tickets = await prisma.queueTicket.findMany({
      where: { status: { in: ["WAITING", "IN_SERVICE"] } },
    });
    expect(tickets.length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────
// TEST-07 / AC-07: Duplicate ticket rejected (BR-01)
// ─────────────────────────────────────────────────────────
describe("TEST-07: Duplicate ticket rejected (BR-01)", () => {
  it("returns 400 DUPLICATE_TICKET when customer already has an active ticket", async () => {
    // First join — should succeed
    await request(app)
      .post("/api/queues/join")
      .set("Cookie", customerCookie)
      .send({ counter_id: counterId });

    // Second join for the same counter — should be rejected
    const res = await request(app)
      .post("/api/queues/join")
      .set("Cookie", customerCookie)
      .send({ counter_id: counterId });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("DUPLICATE_TICKET");
  });

  it("does NOT store a second ticket in the database", async () => {
    await request(app)
      .post("/api/queues/join")
      .set("Cookie", customerCookie)
      .send({ counter_id: counterId });

    await request(app)
      .post("/api/queues/join")
      .set("Cookie", customerCookie)
      .send({ counter_id: counterId });

    const tickets = await prisma.queueTicket.findMany({
      where: { status: { in: ["WAITING", "IN_SERVICE"] } },
    });
    expect(tickets.length).toBe(1); // only the first ticket
  });
});

// ─────────────────────────────────────────────────────────
// TEST-07b / AC-07b: Customer can join a DIFFERENT counter
// ─────────────────────────────────────────────────────────
describe("TEST-07b: Customer joins a different counter — allowed", () => {
  it("returns 201 for a different open counter", async () => {
    // Open Counter B via operator2
    const op2Res = await request(app)
      .post("/api/auth/login")
      .send({ email: "operator2@test.com", password: "password123" });
    const op2Cookie = op2Res.headers["set-cookie"]?.[0] ?? "";

    const boardRes = await request(app).get("/api/board");
    const counterB = boardRes.body.counters.find((c: { name: string }) => c.name === "Counter B");
    const counterBId = counterB?.id;

    await request(app)
      .patch(`/api/counters/${counterBId}/status`)
      .set("Cookie", op2Cookie)
      .send({ status: "OPEN" });

    // Customer joins Counter A
    await request(app)
      .post("/api/queues/join")
      .set("Cookie", customerCookie)
      .send({ counter_id: counterId });

    // Customer joins Counter B — should be allowed (different counter)
    const res = await request(app)
      .post("/api/queues/join")
      .set("Cookie", customerCookie)
      .send({ counter_id: counterBId });

    expect(res.status).toBe(201);
  });
});

// ─────────────────────────────────────────────────────────
// TEST-08 / AC-08: Join closed counter rejected (BR-02)
// ─────────────────────────────────────────────────────────
describe("TEST-08: Join closed counter rejected (BR-02)", () => {
  it("returns 400 COUNTER_CLOSED", async () => {
    // Close counter A
    const opRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "operator1@test.com", password: "password123" });
    const opCookie = opRes.headers["set-cookie"]?.[0] ?? "";

    await request(app)
      .patch(`/api/counters/${counterId}/status`)
      .set("Cookie", opCookie)
      .send({ status: "CLOSED" });

    const res = await request(app)
      .post("/api/queues/join")
      .set("Cookie", customerCookie)
      .send({ counter_id: counterId });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("COUNTER_CLOSED");

    // Re-open for subsequent tests
    await request(app)
      .patch(`/api/counters/${counterId}/status`)
      .set("Cookie", opCookie)
      .send({ status: "OPEN" });
  });
});

// ─────────────────────────────────────────────────────────
// TEST-09 / AC-09: Customer views ticket with correct position
// ─────────────────────────────────────────────────────────
describe("TEST-09: GET /api/queues/my-ticket — with position", () => {
  it("returns ticket with queue position", async () => {
    // customer2 joins first
    await request(app)
      .post("/api/queues/join")
      .set("Cookie", customer2Cookie)
      .send({ counter_id: counterId });

    // customer1 joins second
    await request(app)
      .post("/api/queues/join")
      .set("Cookie", customerCookie)
      .send({ counter_id: counterId });

    const res = await request(app)
      .get("/api/queues/my-ticket")
      .set("Cookie", customerCookie);

    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe("WAITING");
    expect(res.body.position).toBe(1); // 1 person ahead (customer2)
  });
});

// ─────────────────────────────────────────────────────────
// TEST-10 / AC-10: No active ticket returns 404
// ─────────────────────────────────────────────────────────
describe("TEST-10: GET /api/queues/my-ticket — no active ticket", () => {
  it("returns 404 NO_ACTIVE_TICKET", async () => {
    const res = await request(app)
      .get("/api/queues/my-ticket")
      .set("Cookie", customerCookie);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NO_ACTIVE_TICKET");
  });
});

// ─────────────────────────────────────────────────────────
// TEST-11 / AC-11: Public board — no auth required
// ─────────────────────────────────────────────────────────
describe("TEST-11: GET /api/board — no auth required", () => {
  it("returns 200 with counters (no cookie)", async () => {
    const res = await request(app).get("/api/board"); // no cookie
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.counters)).toBe(true);
  });

  it("does not return any private user data", async () => {
    const res = await request(app).get("/api/board");
    for (const counter of res.body.counters) {
      expect(counter.operatorId).toBeUndefined();
    }
  });
});

// ─────────────────────────────────────────────────────────
// TEST-12 / AC-12: Customer cancels a WAITING ticket
// ─────────────────────────────────────────────────────────
describe("TEST-12: DELETE /api/queues/my-ticket — WAITING ticket", () => {
  it("returns 200 and sets ticket to CANCELLED", async () => {
    await request(app)
      .post("/api/queues/join")
      .set("Cookie", customerCookie)
      .send({ counter_id: counterId });

    const res = await request(app)
      .delete("/api/queues/my-ticket")
      .set("Cookie", customerCookie);

    expect(res.status).toBe(200);

    // Verify DB state
    const ticket = await prisma.queueTicket.findFirst({
      orderBy: { createdAt: "desc" },
    });
    expect(ticket?.status).toBe("CANCELLED");
  });
});

// ─────────────────────────────────────────────────────────
// TEST-13 / AC-13: Customer cannot cancel an IN_SERVICE ticket
// ─────────────────────────────────────────────────────────
describe("TEST-13: DELETE /api/queues/my-ticket — IN_SERVICE blocked", () => {
  it("returns 400 TICKET_IN_SERVICE", async () => {
    // Create a ticket and manually set it to IN_SERVICE
    const joinRes = await request(app)
      .post("/api/queues/join")
      .set("Cookie", customerCookie)
      .send({ counter_id: counterId });

    await prisma.queueTicket.update({
      where: { id: joinRes.body.ticket.id },
      data: { status: "IN_SERVICE" },
    });

    const res = await request(app)
      .delete("/api/queues/my-ticket")
      .set("Cookie", customerCookie);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("TICKET_IN_SERVICE");
  });
});

