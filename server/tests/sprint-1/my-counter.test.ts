import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app, prisma } from "../../src/app";

const endpoint = "/api/counters/my-counter";
const cookies: string[] = [];
const counters: { id: number; name: string }[] = [];
let unassignedId: number;

beforeAll(async () => {
  if (!new URL(process.env.DATABASE_URL || "").pathname.endsWith("_test")) {
    throw new Error("Use a dedicated database whose name ends in _test.");
  }
  for (const email of ["operator1@test.com", "operator2@test.com", "customer1@test.com"]) {
    const login = await request(app).post("/api/auth/login").send({ email, password: "password123" });
    expect(login.status).toBe(200);
    cookies.push(login.headers["set-cookie"][0]);
    if (login.body.user.role === "OPERATOR") {
      const counter = await prisma.counter.findUniqueOrThrow({ where: { operatorId: login.body.user.id } });
      counters.push(counter);
    }
  }
  const template = await prisma.user.findUniqueOrThrow({ where: { email: "operator1@test.com" } });
  const user = await prisma.user.create({ data: {
    email: `unassigned-${Date.now()}@test.com`, role: "OPERATOR", passwordHash: template.passwordHash,
  } });
  unassignedId = user.id;
  const login = await request(app).post("/api/auth/login").send({ email: user.email, password: "password123" });
  expect(login.status).toBe(200);
  cookies.push(login.headers["set-cookie"][0]);
});

afterEach(() => { vi.restoreAllMocks(); });
afterAll(async () => {
  if (unassignedId) await prisma.user.delete({ where: { id: unassignedId } });
  await prisma.$disconnect();
});

describe("Issue #1: authenticated counter lookup", () => {
  it.each([0, 1])("returns only operator %i's assigned counter, ignoring query identity", async (index) => {
    const res = await request(app).get(`${endpoint}?operatorId=999&counterId=999`).set("Cookie", cookies[index]);
    expect(res.status).toBe(200);
    expect(res.body.counter).toMatchObject({ id: counters[index].id, name: index === 0 ? "Counter A" : "Counter B" });
    expect(Object.keys(res.body.counter).sort()).toEqual(["currentServing", "id", "name", "status"]);
  });
  it.each([undefined, "token=invalid"])("rejects unauthenticated requests (%s)", async (cookie) => {
    const req = request(app).get(endpoint);
    if (cookie) req.set("Cookie", cookie);
    const res = await req;
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });
  it("rejects customers", async () => {
    const res = await request(app).get(endpoint).set("Cookie", cookies[2]);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });
  it("returns a distinct no-assignment result", async () => {
    const res = await request(app).get(endpoint).set("Cookie", cookies[3]);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NO_ASSIGNED_COUNTER");
  });
  it("does not expose database details on failure", async () => {
    // Prisma delegates are proxies: preserve the callable explicitly.
    const findUnique = prisma.counter.findUnique;
    prisma.counter.findUnique = vi.fn().mockRejectedValue(new Error("private database details"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await request(app).get(endpoint).set("Cookie", cookies[0]);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "Failed to load your counter", code: "COUNTER_LOAD_FAILED" });
    } finally {
      prisma.counter.findUnique = findUnique;
    }
  });
  it("keeps the public board free of operator identity", async () => {
    const res = await request(app).get("/api/board");
    expect(res.status).toBe(200);
    expect(res.body.counters.length).toBeGreaterThanOrEqual(2);
    for (const counter of res.body.counters) {
      expect(Object.keys(counter).sort()).toEqual(["currentServing", "id", "name", "status"]);
    }
  });
});

describe.each([0, 1])("AC-18: operator %i cannot mutate the other counter", (index) => {
  it.each(["status", "next", "serve"])("rejects %s without changing the database", async (action) => {
    const before = { counters: await prisma.counter.findMany(), tickets: await prisma.queueTicket.findMany() };
    const path = `/api/counters/${counters[1 - index].id}/${action}`;
    const req = action === "status" ? request(app).patch(path).send({ status: "CLOSED" }) : request(app).post(path);
    const res = await req.set("Cookie", cookies[index]);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
    expect({ counters: await prisma.counter.findMany(), tickets: await prisma.queueTicket.findMany() }).toEqual(before);
  });
});
