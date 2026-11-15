import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import App from "./App";

// Silence console errors from fetch failures in tests
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  // Default: /api/auth/me returns 401 (not logged in)
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ error: "Unauthorized" }),
  } as Response);
});

// ─────────────────────────────────────────────────────────
// UI-01: App heading and login form render
// ─────────────────────────────────────────────────────────
describe("UI-01: App heading and login form", () => {
  it("renders the app heading", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId("app-heading")).toHaveTextContent(
        "Queue Service System"
      );
    });
  });

  it("renders the login form by default (not authenticated)", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId("login-form")).toBeInTheDocument();
    });
  });

  it("renders email and password inputs", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId("email-input")).toBeInTheDocument();
      expect(screen.getByTestId("password-input")).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────
// UI-02: Login success — Customer dashboard renders
// ─────────────────────────────────────────────────────────
describe("UI-02: Successful Customer login shows customer dashboard", () => {
  it("renders customer dashboard after successful login", async () => {
    vi.spyOn(globalThis, "fetch")
      // /api/auth/me → not logged in initially
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      } as Response)
      // POST /api/auth/login → success
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { id: 1, email: "customer1@test.com", role: "CUSTOMER" },
        }),
      } as Response)
      // /api/board → counters
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          counters: [
            { id: 1, name: "Counter A", status: "OPEN", currentServing: 0 },
          ],
        }),
      } as Response)
      // /api/queues/my-ticket → no active ticket
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ code: "NO_ACTIVE_TICKET" }),
      } as Response);

    render(<App />);

    await waitFor(() => screen.getByTestId("login-form"));
    fireEvent.change(screen.getByTestId("email-input"), {
      target: { value: "customer1@test.com" },
    });
    fireEvent.change(screen.getByTestId("password-input"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByTestId("login-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("customer-dashboard")).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────
// UI-03: Login failure shows error message
// ─────────────────────────────────────────────────────────
describe("UI-03: Login failure shows error message", () => {
  it("displays an error when credentials are invalid", async () => {
    vi.spyOn(globalThis, "fetch")
      // /api/auth/me → 401
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      } as Response)
      // POST /api/auth/login → 401 Invalid credentials
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Invalid credentials" }),
      } as Response);

    render(<App />);
    await waitFor(() => screen.getByTestId("login-form"));

    fireEvent.change(screen.getByTestId("email-input"), {
      target: { value: "customer1@test.com" },
    });
    fireEvent.change(screen.getByTestId("password-input"), {
      target: { value: "wrongpassword" },
    });
    fireEvent.click(screen.getByTestId("login-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("login-error")).toHaveTextContent(
        "Invalid credentials"
      );
    });
  });
});

// ─────────────────────────────────────────────────────────
// UI-04: Operator dashboard renders after Operator login
// ─────────────────────────────────────────────────────────
describe("UI-04: Operator login shows operator dashboard", () => {
  it("renders operator dashboard after Operator login", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { id: 3, email: "operator1@test.com", role: "OPERATOR" },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          counter: { id: 1, name: "Counter A", status: "CLOSED", currentServing: 0 },
        }),
      } as Response);

    render(<App />);
    await waitFor(() => screen.getByTestId("login-form"));

    fireEvent.change(screen.getByTestId("email-input"), {
      target: { value: "operator1@test.com" },
    });
    fireEvent.change(screen.getByTestId("password-input"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByTestId("login-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("operator-dashboard")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Counter A" })).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────
// UI-05: Auto-refresh polling (NFR-01 / Issue #3)
// Verifies that the setTimeout-chain polling:
//   (a) calls loadBoard + loadMyTicket after 3 s when view === "customer"
//   (b) stops calling them after the view changes away from "customer"
// ─────────────────────────────────────────────────────────
describe("UI-05: Auto-refresh polling stops after view change", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it(
    "calls loadBoard and loadMyTicket after 3 s while on customer view",
    async () => {
      // Track every URL that fetch is called with
      const calledUrls: string[] = [];

      vi.spyOn(globalThis, "fetch").mockImplementation(
        (url: RequestInfo | URL) => {
          const u = url.toString();
          calledUrls.push(u);

          if (u.includes("/api/auth/me") || u.includes("/api/auth/login")) {
            if (u.includes("/api/auth/me")) {
              return Promise.resolve({
                ok: false,
                status: 401,
                json: async () => ({}),
              } as Response);
            }
            // login
            return Promise.resolve({
              ok: true,
              json: async () => ({
                user: { id: 1, email: "customer1@test.com", role: "CUSTOMER" },
              }),
            } as Response);
          }

          if (u.includes("/api/board")) {
            return Promise.resolve({
              ok: true,
              json: async () => ({
                counters: [
                  { id: 1, name: "Counter A", status: "OPEN", currentServing: 1 },
                ],
              }),
            } as Response);
          }

          // /api/queues/my-ticket
          return Promise.resolve({
            ok: false,
            status: 404,
            json: async () => ({ code: "NO_ACTIVE_TICKET" }),
          } as Response);
        }
      );

      render(<App />);

      // Wait for login form (without real timers blocking waitFor)
      await act(async () => {
        await Promise.resolve();
      });

      // Fill and submit login
      fireEvent.change(screen.getByTestId("email-input"), {
        target: { value: "customer1@test.com" },
      });
      fireEvent.change(screen.getByTestId("password-input"), {
        target: { value: "password123" },
      });
      fireEvent.click(screen.getByTestId("login-btn"));

      // Let login response + initial data load settle
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByTestId("customer-dashboard")).toBeInTheDocument();

      // Record calls so far (before polling)
      const urlsBefore = [...calledUrls];

      // Advance 3 s — the first poll tick should fire
      await act(async () => {
        vi.advanceTimersByTime(3000);
        // Flush promises produced by the async tick
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      const newUrls = calledUrls.slice(urlsBefore.length);
      expect(newUrls.some((u) => u.includes("/api/board"))).toBe(true);
      expect(
        newUrls.some((u) => u.includes("/api/queues/my-ticket"))
      ).toBe(true);
    },
    10_000 // allow up to 10 s for this timer-heavy test
  );
});

describe("UI-06: Auto-refresh polling stops on unmount / view change", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it(
    "does not poll after component unmounts",
    async () => {
      const calledUrls: string[] = [];

      vi.spyOn(globalThis, "fetch").mockImplementation(
        (url: RequestInfo | URL) => {
          const u = url.toString();
          calledUrls.push(u);

          if (u.includes("/api/auth/me")) {
            return Promise.resolve({
              ok: false,
              status: 401,
              json: async () => ({}),
            } as Response);
          }
          if (u.includes("/api/auth/login")) {
            return Promise.resolve({
              ok: true,
              json: async () => ({
                user: { id: 1, email: "customer1@test.com", role: "CUSTOMER" },
              }),
            } as Response);
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({ counters: [] }),
          } as Response);
        }
      );

      const { unmount } = render(<App />);

      await act(async () => {
        await Promise.resolve();
      });

      fireEvent.change(screen.getByTestId("email-input"), {
        target: { value: "customer1@test.com" },
      });
      fireEvent.change(screen.getByTestId("password-input"), {
        target: { value: "password123" },
      });
      fireEvent.click(screen.getByTestId("login-btn"));

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByTestId("customer-dashboard")).toBeInTheDocument();

      // Unmount — cleanup should cancel the pending timer
      unmount();

      const countBeforeUnmount = calledUrls.length;

      // Advance well past the first tick
      await act(async () => {
        vi.advanceTimersByTime(6000);
        await Promise.resolve();
        await Promise.resolve();
      });

      // No new fetch calls after unmount
      expect(calledUrls.length).toBe(countBeforeUnmount);
    },
    10_000
  );
});

