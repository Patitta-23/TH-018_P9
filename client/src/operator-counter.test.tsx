import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";

const counterA = { id: 17, name: "Counter A", status: "CLOSED", currentServing: 0 };
const counterB = { id: 29, name: "Counter B", status: "CLOSED", currentServing: 0 };
const operator = (id: number) => ({ id, email: `operator${id}@test.com`, role: "OPERATOR" });
const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

function setup(counter: typeof counterA, load?: () => Promise<Response>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === "/api/auth/me") return response(operator(counter.id));
    if (url === "/api/counters/my-counter") return load ? load() : response({ counter });
    if (url === "/api/board") return response({ counters: [counterA, counterB] });
    if (url.endsWith("/status")) return response({ counter: { id: counter.id, ...JSON.parse(String(init?.body)) } });
    if (url.endsWith("/next")) return response({ ticket: { id: 11, queueNumber: 8 } });
    if (url.endsWith("/serve")) return response({ ticket: { id: 11, status: "SERVED" } });
    if (url === "/api/auth/logout") return response({ message: "Logged out" });
    if (url === "/api/auth/login") return response({ user: operator(29) });
    throw new Error(`Unexpected request: ${url}`);
  });
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Issue #1 operator assignment regression", () => {
  it.each([counterA, counterB])("shows $name and sends every action to its assigned ID", async (counter) => {
    const fetchMock = setup(counter);
    render(<App />);
    expect(await screen.findByRole("heading", { name: counter.name })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: counter.id === 17 ? "Counter B" : "Counter A" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/counters/my-counter", expect.objectContaining({ credentials: "include" }));
    expect(screen.getByTestId("call-next-btn")).toBeDisabled();
    fireEvent.click(screen.getByTestId("open-counter-btn"));
    await screen.findByTestId("close-counter-btn");
    fireEvent.click(screen.getByTestId("call-next-btn"));
    await waitFor(() => expect(screen.getByTestId("operator-success")).toHaveTextContent("Now serving #8"));
    fireEvent.click(screen.getByTestId("mark-served-btn"));
    await waitFor(() => expect(screen.getByTestId("operator-success")).toHaveTextContent("marked as SERVED"));
    fireEvent.click(screen.getByTestId("close-counter-btn"));
    await screen.findByTestId("open-counter-btn");
    const actions = fetchMock.mock.calls.filter(([, init]) => init?.method);
    expect(actions.map(([url]) => url)).toEqual(["status", "next", "serve", "status"].map(action => `/api/counters/${counter.id}/${action}`));
    expect(actions.every(([, init]) => init?.credentials === "include")).toBe(true);
  });

  it("shows loading without an unassigned message or action controls", async () => {
    let resolve!: (value: Response) => void;
    setup(counterB, () => new Promise(r => { resolve = r; }));
    render(<App />);
    expect(await screen.findByTestId("counter-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("no-counter-msg")).not.toBeInTheDocument();
    expect(screen.queryByTestId("call-next-btn")).not.toBeInTheDocument();
    await act(async () => resolve(response({ counter: counterB })));
    expect(await screen.findByRole("heading", { name: "Counter B" })).toBeInTheDocument();
  });

  it("shows an unassigned message only for NO_ASSIGNED_COUNTER", async () => {
    setup(counterB, async () => response({ code: "NO_ASSIGNED_COUNTER" }, 404));
    render(<App />);
    expect(await screen.findByTestId("no-counter-msg")).toBeInTheDocument();
    expect(screen.queryByTestId("operator-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("call-next-btn")).not.toBeInTheDocument();
  });

  it.each([401, 403, 404, 500, "network"])("shows a recoverable error for %s", async (status) => {
    let fail = true;
    setup(counterB, async () => {
      if (!fail) return response({ counter: counterB });
      if (status === "network") throw new Error("offline");
      return response({ error: "Request failed" }, Number(status));
    });
    render(<App />);
    expect(await screen.findByTestId("counter-load-error")).toBeInTheDocument();
    expect(screen.queryByTestId("no-counter-msg")).not.toBeInTheDocument();
    expect(screen.queryByTestId("call-next-btn")).not.toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Counter B" })).toBeInTheDocument();
    expect(screen.queryByTestId("counter-load-error")).not.toBeInTheDocument();
  });

  it("ignores an old counter response after logout and a new login", async () => {
    let resolveOld!: (value: Response) => void;
    let loads = 0;
    setup(counterA, () => ++loads === 1 ? new Promise(r => { resolveOld = r; }) : Promise.resolve(response({ counter: counterB })));
    render(<App />);
    await screen.findByTestId("counter-loading");
    fireEvent.click(screen.getByTestId("logout-btn"));
    await screen.findByTestId("login-form");
    fireEvent.change(screen.getByTestId("email-input"), { target: { value: "operator2@test.com" } });
    fireEvent.change(screen.getByTestId("password-input"), { target: { value: "password123" } });
    fireEvent.click(screen.getByTestId("login-btn"));
    await screen.findByRole("heading", { name: "Counter B" });
    await act(async () => resolveOld(response({ counter: counterA })));
    expect(screen.getByRole("heading", { name: "Counter B" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Counter A" })).not.toBeInTheDocument();
  });
});
