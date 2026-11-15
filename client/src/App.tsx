import { useState, useEffect, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────
type Role = "CUSTOMER" | "OPERATOR";

interface User {
  id: number;
  email: string;
  role: Role;
}

interface Counter {
  id: number;
  name: string;
  status: "OPEN" | "CLOSED";
  currentServing: number;
}

interface Ticket {
  id: number;
  queueNumber: number;
  status: "WAITING" | "IN_SERVICE" | "SERVED" | "CANCELLED";
  counter: Counter;
}

// ─── App View State ──────────────────────────────────────
type View = "login" | "customer" | "operator";

function App() {
  const [view, setView] = useState<View>("login");
  const [user, setUser] = useState<User | null>(null);

  // Login form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Customer state
  const [counters, setCounters] = useState<Counter[]>([]);
  const [myTicket, setMyTicket] = useState<Ticket | null>(null);
  const [myPosition, setMyPosition] = useState<number>(0);
  const [customerMsg, setCustomerMsg] = useState("");
  const [customerError, setCustomerError] = useState("");

  // Operator state
  const [myCounter, setMyCounter] = useState<Counter | null>(null);
  const [operatorMsg, setOperatorMsg] = useState("");
  const [operatorError, setOperatorError] = useState("");

  // ── Restore session on mount ──────────────────────────
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: User | null) => {
        if (data) {
          setUser(data);
          setView(data.role === "CUSTOMER" ? "customer" : "operator");
        }
      })
      .catch(() => {});
  }, []);

  // ── Load board (counters) ──────────────────────────────
  const loadBoard = useCallback(async () => {
    try {
      const res = await fetch("/api/board");
      const data = await res.json();
      setCounters(data.counters ?? []);
    } catch {
      setCustomerError("Failed to load counters.");
    }
  }, []);

  // ── Load customer's active ticket ─────────────────────
  const loadMyTicket = useCallback(async () => {
    try {
      const res = await fetch("/api/queues/my-ticket", { credentials: "include" });
      if (res.status === 404) {
        setMyTicket(null);
        return;
      }
      const data = await res.json();
      setMyTicket(data.ticket ?? null);
      setMyPosition(data.position ?? 0);
    } catch {
      setCustomerError("Failed to load your ticket.");
    }
  }, []);

  // ── Load operator's counter ───────────────────────────
  const loadMyCounter = useCallback(async () => {
    if (!user) return;
    const res = await fetch("/api/board");
    const data = await res.json();
    // Find counter assigned to this operator (heuristic: board includes all counters)
    // The operator sees only their own counter via ownership rules
    setMyCounter(data.counters?.[0] ?? null); // placeholder — refine per your needs
  }, [user]);

  useEffect(() => {
    if (view === "customer") {
      loadBoard();
      loadMyTicket();
    }
    if (view === "operator") {
      loadMyCounter();
    }
  }, [view, loadBoard, loadMyTicket, loadMyCounter]);

  // ─────────────────────────────────────────────────────
  // AUTH ACTIONS
  // ─────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error ?? "Login failed");
        return;
      }

      setUser(data.user);
      setView(data.user.role === "CUSTOMER" ? "customer" : "operator");
    } catch {
      setLoginError("Unable to connect to server.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    setMyTicket(null);
    setMyCounter(null);
    setView("login");
  };

  // ─────────────────────────────────────────────────────
  // CUSTOMER ACTIONS
  // ─────────────────────────────────────────────────────
  const handleJoinQueue = async (counterId: number) => {
    setCustomerMsg("");
    setCustomerError("");
    try {
      const res = await fetch("/api/queues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ counter_id: counterId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCustomerError(data.error ?? "Failed to join queue.");
        return;
      }
      setCustomerMsg(`✅ Joined queue! Your number is #${data.ticket.queueNumber}`);
      await loadMyTicket();
      await loadBoard();
    } catch {
      setCustomerError("Failed to join queue.");
    }
  };

  const handleCancelTicket = async () => {
    setCustomerMsg("");
    setCustomerError("");
    try {
      const res = await fetch("/api/queues/my-ticket", {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setCustomerError(data.error ?? "Failed to cancel ticket.");
        return;
      }
      setCustomerMsg("🗑️ Ticket cancelled.");
      setMyTicket(null);
      await loadBoard();
    } catch {
      setCustomerError("Failed to cancel ticket.");
    }
  };

  // ─────────────────────────────────────────────────────
  // OPERATOR ACTIONS
  // ─────────────────────────────────────────────────────
  const handleCounterStatus = async (status: "OPEN" | "CLOSED") => {
    if (!myCounter) return;
    setOperatorMsg("");
    setOperatorError("");
    try {
      const res = await fetch(`/api/counters/${myCounter.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOperatorError(data.error ?? "Failed to update counter status.");
        return;
      }
      setMyCounter((prev) => (prev ? { ...prev, status: data.counter.status } : prev));
      setOperatorMsg(`Counter is now ${data.counter.status}.`);
    } catch {
      setOperatorError("Failed to update counter status.");
    }
  };

  const handleCallNext = async () => {
    if (!myCounter) return;
    setOperatorMsg("");
    setOperatorError("");
    try {
      const res = await fetch(`/api/counters/${myCounter.id}/next`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setOperatorError(data.error ?? "Failed to call next.");
        return;
      }
      setOperatorMsg(`📢 Now serving #${data.ticket.queueNumber}`);
      setMyCounter((prev) =>
        prev ? { ...prev, currentServing: data.ticket.queueNumber } : prev
      );
    } catch {
      setOperatorError("Failed to call next customer.");
    }
  };

  const handleMarkServed = async () => {
    if (!myCounter) return;
    setOperatorMsg("");
    setOperatorError("");
    try {
      const res = await fetch(`/api/counters/${myCounter.id}/serve`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setOperatorError(data.error ?? "Failed to mark as served.");
        return;
      }
      setOperatorMsg(`✅ Ticket #${data.ticket.id} marked as SERVED.`);
    } catch {
      setOperatorError("Failed to mark as served.");
    }
  };

  // ─────────────────────────────────────────────────────
  // RENDER: Shared nav bar
  // ─────────────────────────────────────────────────────
  const NavBar = () => (
    <nav className="navbar navbar-dark bg-primary mb-4">
      <div className="container">
        <span className="navbar-brand" data-testid="app-heading">
          🎫 Queue Service System
        </span>
        {user && (
          <div className="d-flex align-items-center gap-3">
            <span className="text-white small">
              {user.email} ({user.role})
            </span>
            <button
              className="btn btn-outline-light btn-sm"
              onClick={handleLogout}
              data-testid="logout-btn"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );

  // ─────────────────────────────────────────────────────
  // RENDER: Login view
  // ─────────────────────────────────────────────────────
  if (view === "login") {
    return (
      <>
        <NavBar />
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-md-4">
              <div className="card shadow-sm">
                <div className="card-body">
                  <h5 className="card-title mb-4 text-center">Sign In</h5>
                  <form onSubmit={handleLogin} data-testid="login-form">
                    <div className="mb-3">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        data-testid="email-input"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Password</label>
                      <input
                        type="password"
                        className="form-control"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        data-testid="password-input"
                      />
                    </div>
                    {loginError && (
                      <div className="alert alert-danger py-2" data-testid="login-error">
                        {loginError}
                      </div>
                    )}
                    <button
                      type="submit"
                      className="btn btn-primary w-100"
                      disabled={loginLoading}
                      data-testid="login-btn"
                    >
                      {loginLoading ? "Signing in…" : "Sign In"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─────────────────────────────────────────────────────
  // RENDER: Customer dashboard
  // ─────────────────────────────────────────────────────
  if (view === "customer") {
    return (
      <>
        <NavBar />
        <div className="container" data-testid="customer-dashboard">
          <div className="row g-4">
            {/* My active ticket */}
            <div className="col-md-5">
              <div className="card shadow-sm h-100">
                <div className="card-header bg-success text-white">My Queue Ticket</div>
                <div className="card-body">
                  {myTicket ? (
                    <div data-testid="ticket-info">
                      <p className="fs-1 text-center fw-bold text-primary">
                        #{myTicket.queueNumber}
                      </p>
                      <table className="table table-sm">
                        <tbody>
                          <tr>
                            <th>Counter</th>
                            <td>{myTicket.counter.name}</td>
                          </tr>
                          <tr>
                            <th>Status</th>
                            <td>
                              <span
                                className={`badge ${
                                  myTicket.status === "IN_SERVICE"
                                    ? "bg-warning text-dark"
                                    : "bg-secondary"
                                }`}
                              >
                                {myTicket.status}
                              </span>
                            </td>
                          </tr>
                          <tr>
                            <th>Serving now</th>
                            <td>#{myTicket.counter.currentServing}</td>
                          </tr>
                          <tr>
                            <th>People ahead</th>
                            <td>{myPosition}</td>
                          </tr>
                        </tbody>
                      </table>
                      {myTicket.status === "WAITING" && (
                        <button
                          className="btn btn-danger btn-sm w-100 mt-2"
                          onClick={handleCancelTicket}
                          data-testid="cancel-ticket-btn"
                        >
                          Cancel Ticket
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted text-center mt-4" data-testid="no-ticket-msg">
                      No active ticket. Join a queue below.
                    </p>
                  )}
                  {customerMsg && (
                    <div className="alert alert-success mt-3 py-2" data-testid="customer-success">
                      {customerMsg}
                    </div>
                  )}
                  {customerError && (
                    <div className="alert alert-danger mt-3 py-2" data-testid="customer-error">
                      {customerError}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Available counters */}
            <div className="col-md-7">
              <div className="card shadow-sm h-100">
                <div className="card-header bg-primary text-white">
                  Available Counters
                  <button
                    className="btn btn-outline-light btn-sm float-end"
                    onClick={loadBoard}
                    data-testid="refresh-board-btn"
                  >
                    ↻ Refresh
                  </button>
                </div>
                <div className="card-body">
                  {counters.length === 0 ? (
                    <p className="text-muted">No counters available.</p>
                  ) : (
                    <table className="table table-hover">
                      <thead>
                        <tr>
                          <th>Counter</th>
                          <th>Status</th>
                          <th>Serving #</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {counters.map((c) => (
                          <tr key={c.id}>
                            <td>{c.name}</td>
                            <td>
                              <span
                                className={`badge ${
                                  c.status === "OPEN" ? "bg-success" : "bg-secondary"
                                }`}
                              >
                                {c.status}
                              </span>
                            </td>
                            <td>#{c.currentServing}</td>
                            <td>
                              <button
                                className="btn btn-primary btn-sm"
                                disabled={
                                  c.status === "CLOSED" ||
                                  (myTicket !== null && myTicket.counter.id === c.id)
                                }
                                onClick={() => handleJoinQueue(c.id)}
                                data-testid={`join-btn-${c.id}`}
                              >
                                Join
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─────────────────────────────────────────────────────
  // RENDER: Operator dashboard
  // ─────────────────────────────────────────────────────
  return (
    <>
      <NavBar />
      <div className="container" data-testid="operator-dashboard">
        <div className="row justify-content-center">
          <div className="col-md-6">
            <div className="card shadow-sm">
              <div className="card-header bg-warning text-dark fw-bold">
                Operator Dashboard
              </div>
              <div className="card-body">
                {myCounter ? (
                  <>
                    <h5 className="mb-3">{myCounter.name}</h5>
                    <table className="table table-sm mb-4">
                      <tbody>
                        <tr>
                          <th>Status</th>
                          <td>
                            <span
                              className={`badge ${
                                myCounter.status === "OPEN" ? "bg-success" : "bg-secondary"
                              }`}
                            >
                              {myCounter.status}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <th>Now serving</th>
                          <td>#{myCounter.currentServing}</td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="d-grid gap-2">
                      {myCounter.status === "CLOSED" ? (
                        <button
                          className="btn btn-success"
                          onClick={() => handleCounterStatus("OPEN")}
                          data-testid="open-counter-btn"
                        >
                          Open Counter
                        </button>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleCounterStatus("CLOSED")}
                          data-testid="close-counter-btn"
                        >
                          Close Counter
                        </button>
                      )}
                      <button
                        className="btn btn-primary"
                        onClick={handleCallNext}
                        disabled={myCounter.status === "CLOSED"}
                        data-testid="call-next-btn"
                      >
                        📢 Call Next Customer
                      </button>
                      <button
                        className="btn btn-outline-success"
                        onClick={handleMarkServed}
                        disabled={myCounter.status === "CLOSED"}
                        data-testid="mark-served-btn"
                      >
                        ✅ Mark as Served
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-muted" data-testid="no-counter-msg">
                    No counter assigned. Contact admin.
                  </p>
                )}

                {operatorMsg && (
                  <div className="alert alert-success mt-3 py-2" data-testid="operator-success">
                    {operatorMsg}
                  </div>
                )}
                {operatorError && (
                  <div className="alert alert-danger mt-3 py-2" data-testid="operator-error">
                    {operatorError}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;

