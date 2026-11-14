import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { app, prisma } from "../../src/app";

// ─────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────
let operator1Cookie: string;
let operator2Cookie: string;
let customerCookie: string;
let counter1Id: number;
let counter2Id: number;

beforeAll(async () => {
  const op1Res = await request(app)
    .post("/api/auth/login")
    .send({ email: "operator1@test.com", password: "password123" });
  operator1Cookie = op1Res.headers["set-cookie"]?.[0] ?? "";

  const op2Res = await request(app)
    .post("/api/auth/login")
    .send({ email: "operator2@test.com", password: "password123" });
  operator2Cookie = op2Res.headers["set-cookie"]?.[0] ?? "";

  const custRes = await request(app)
    .post("/api/auth/login")
    .send({ email: "customer1@test.com", password: "password123" });
  customerCookie = custRes.headers["set-cookie"]?.[0] ?? "";

  const boardRes = await request(app).get("/api/board");
  const counterA = boardRes.body.counters.find((c: { name: string }) => c.name === "Counter A");
  const counterB = boardRes.body.counters.find((c: { name: string }) => c.name === "Counter B");
  counter1Id = counterA?.id ?? 1;
  counter2Id = counterB?.id ?? 2;
});

beforeEach(async () => {
  // Reset tickets and restore counter state
  await prisma.queueTicket.deleteMany({});
  await prisma.counter.update({
    where: { id: counter1Id },
    data: { status: "OPEN", currentServing: 0 },
  });
  await prisma.counter.update({
    where: { id: counter2Id },
    data: { status: "OPEN", currentServing: 0 },
  });
});

afterAll(async () => {
  await prisma.queueTicket.deleteMany({});
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────
// TEST-14 / AC-14: Operator opens their counter
// ─────────────────────────────────────────────────────────
describe("TEST-14: PATCH /api/counters/:id/status — Operator opens counter", () => {
  it("returns 200 and counter status = OPEN", async () => {
    // First close it
    await prisma.counter.update({
      where: { id: counter1Id },
      data: { status: "CLOSED" },
    });

    const res = await request(app)
      .patch(`/api/counters/${counter1Id}/status`)
      .set("Cookie", operator1Cookie)
      .send({ status: "OPEN" });

    expect(res.status).toBe(200);
    expect(res.body.counter.status).toBe("OPEN");

    const counter = await prisma.counter.findUnique({ where: { id: counter1Id } });
    expect(counter?.status).toBe("OPEN");
  });
});

// ─────────────────────────────────────────────────────────
// TEST-15 / AC-15: Operator calls next customer
// ─────────────────────────────────────────────────────────
describe("TEST-15: POST /api/counters/:id/next — calls next customer", () => {
  it("returns 200 and ticket becomes IN_SERVICE", async () => {
    // Create a waiting ticket
    await prisma.queueTicket.create({
      data: {
        queueNumber: 1,
        status: "WAITING",
        customer: { connect: { email: "customer1@test.com" } },
        counter: { connect: { id: counter1Id } },
      },
    });

    const res = await request(app)
      .post(`/api/counters/${counter1Id}/next`)
      .set("Cookie", operator1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe("IN_SERVICE");
  });

  it("increments counter's currentServing number", async () => {
    await prisma.queueTicket.create({
      data: {
        queueNumber: 1,
        status: "WAITING",
        customer: { connect: { email: "customer1@test.com" } },
        counter: { connect: { id: counter1Id } },
      },
    });

    await request(app)
      .post(`/api/counters/${counter1Id}/next`)
      .set("Cookie", operator1Cookie);

    const counter = await prisma.counter.findUnique({ where: { id: counter1Id } });
    expect(counter?.currentServing).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────
// TEST-16 / AC-16: Call next blocked when IN_SERVICE exists (BR-03)
// ─────────────────────────────────────────────────────────
describe("TEST-16: Call next blocked while customer is IN_SERVICE (BR-03)", () => {
  it("returns 400 CUSTOMER_IN_SERVICE", async () => {
    // Set up: one IN_SERVICE + one WAITING ticket
    await prisma.queueTicket.create({
      data: {
        queueNumber: 1,
        status: "IN_SERVICE",
        customer: { connect: { email: "customer1@test.com" } },
        counter: { connect: { id: counter1Id } },
      },
    });
    await prisma.queueTicket.create({
      data: {
        queueNumber: 2,
        status: "WAITING",
        customer: { connect: { email: "customer2@test.com" } },
        counter: { connect: { id: counter1Id } },
      },
    });

    const res = await request(app)
      .post(`/api/counters/${counter1Id}/next`)
      .set("Cookie", operator1Cookie);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("CUSTOMER_IN_SERVICE");
  });
});

// ─────────────────────────────────────────────────────────
// TEST-17 / AC-17: Operator marks current customer as served
// ─────────────────────────────────────────────────────────
describe("TEST-17: POST /api/counters/:id/serve — mark served", () => {
  it("returns 200 and ticket becomes SERVED", async () => {
    await prisma.queueTicket.create({
      data: {
        queueNumber: 1,
        status: "IN_SERVICE",
        customer: { connect: { email: "customer1@test.com" } },
        counter: { connect: { id: counter1Id } },
      },
    });

    const res = await request(app)
      .post(`/api/counters/${counter1Id}/serve`)
      .set("Cookie", operator1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe("SERVED");
  });
});

// ─────────────────────────────────────────────────────────
// TEST-18 / AC-18: Operator cannot act on another operator's counter (BR-04)
// ─────────────────────────────────────────────────────────
describe("TEST-18: Operator forbidden on another operator's counter (BR-04)", () => {
  it("returns 403 FORBIDDEN when calling next on other's counter", async () => {
    // operator2 tries to call next on counter1 (owned by operator1)
    const res = await request(app)
      .post(`/api/counters/${counter1Id}/next`)
      .set("Cookie", operator2Cookie);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("returns 403 FORBIDDEN when changing status of other's counter", async () => {
    const res = await request(app)
      .patch(`/api/counters/${counter1Id}/status`)
      .set("Cookie", operator2Cookie)
      .send({ status: "CLOSED" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });
});

