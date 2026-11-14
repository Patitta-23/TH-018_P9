import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app, prisma } from "../../src/app";

// ─────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────
let customerCookie: string;
let operatorCookie: string;

beforeAll(async () => {
  // Obtain a valid Customer session cookie
  const customerRes = await request(app)
    .post("/api/auth/login")
    .send({ email: "customer1@test.com", password: "password123" });
  customerCookie = customerRes.headers["set-cookie"]?.[0] ?? "";

  // Obtain a valid Operator session cookie
  const operatorRes = await request(app)
    .post("/api/auth/login")
    .send({ email: "operator1@test.com", password: "password123" });
  operatorCookie = operatorRes.headers["set-cookie"]?.[0] ?? "";
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────
// TEST-01 / AC-01: Valid Customer login
// ─────────────────────────────────────────────────────────
describe("TEST-01: POST /api/auth/login — valid Customer", () => {
  it("returns HTTP 200", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "customer1@test.com", password: "password123" });
    expect(res.status).toBe(200);
  });

  it("sets an HTTP-only token cookie", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "customer1@test.com", password: "password123" });
    expect(res.headers["set-cookie"]).toBeDefined();
    expect(res.headers["set-cookie"][0]).toContain("token=");
  });

  it("returns user with role CUSTOMER", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "customer1@test.com", password: "password123" });
    expect(res.body.user.role).toBe("CUSTOMER");
  });
});

// ─────────────────────────────────────────────────────────
// TEST-01b / AC-01b: Valid Operator login
// ─────────────────────────────────────────────────────────
describe("TEST-01b: POST /api/auth/login — valid Operator", () => {
  it("returns role OPERATOR", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "operator1@test.com", password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("OPERATOR");
  });
});

// ─────────────────────────────────────────────────────────
// TEST-02 / AC-02: Invalid credentials
// ─────────────────────────────────────────────────────────
describe("TEST-02: POST /api/auth/login — wrong password", () => {
  it("returns HTTP 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "customer1@test.com", password: "wrongpassword" });
    expect(res.status).toBe(401);
  });

  it("does not set a cookie", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "customer1@test.com", password: "wrongpassword" });
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("does not return private user data", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "customer1@test.com", password: "wrongpassword" });
    expect(res.body.user).toBeUndefined();
    expect(res.body.passwordHash).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────
// TEST-03 / AC-03: Logout clears session
// ─────────────────────────────────────────────────────────
describe("TEST-03: POST /api/auth/logout", () => {
  it("returns 200 and clears cookie", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", customerCookie);
    expect(res.status).toBe(200);
    // Cookie should be cleared (token= with expired date or empty)
    const setCookie = res.headers["set-cookie"]?.[0] ?? "";
    expect(setCookie).toContain("token=;");
  });
});

// ─────────────────────────────────────────────────────────
// TEST-04 / AC-04: Unauthenticated access to protected endpoint (NFR-02)
// ─────────────────────────────────────────────────────────
describe("TEST-04: Unauthenticated request to protected endpoint", () => {
  it("returns HTTP 401 without private data", async () => {
    const res = await request(app).get("/api/queues/my-ticket"); // no cookie
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
    expect(res.body.user).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────
// TEST-05 / AC-05: Customer accessing Operator-only endpoint (NFR-03)
// ─────────────────────────────────────────────────────────
describe("TEST-05: Customer accessing Operator endpoint", () => {
  it("returns HTTP 403", async () => {
    const res = await request(app)
      .post("/api/counters/1/next")
      .set("Cookie", customerCookie);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });
});

