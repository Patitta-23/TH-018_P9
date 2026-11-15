# Part E — Feature Engineering Contract: F-05 & F-06 Operator Counter Management

> **Sprint 1** | Linked: FR-04, FR-05, FR-06, BR-03, BR-04 | File: `docs/sprints/sprint-1/F-05-F-06-operator.md`
> Version history: v1.0 — initial contract (before implementation)

---

## F-06: Open / Close Counter

### Feature Description

Operator opens or closes their assigned counter.
When OPEN, customers can join the queue.
When CLOSED, new joins are rejected (BR-02 in F-01).

**Linked requirements:** FR-06, BR-04

### UI Behavior

- Operator Dashboard shows current counter name and status badge
- "Open Counter" button when status = CLOSED → calls PATCH with `{ status: "OPEN" }`
- "Close Counter" button when status = OPEN → calls PATCH with `{ status: "CLOSED" }`
- "Call Next" and "Mark Served" buttons disabled when counter is CLOSED
- Success banner shows new status after update

### API Specification

#### PATCH /api/counters/:id/status
```
Request:  { status: "OPEN" | "CLOSED" }

Response 200:
  { "counter": { "id": number, "status": "OPEN" | "CLOSED" } }

Response 400: { "error": "status must be OPEN or CLOSED", "code": "INVALID_STATUS" }
Response 403: { "error": "Not your counter",              "code": "FORBIDDEN" }   ← BR-04
Response 404: { "error": "Counter not found",             "code": "COUNTER_NOT_FOUND" }
```

### Acceptance Criteria

| AC ID | Scenario | Expected Outcome |
|-------|----------|-----------------|
| **AC-14** | Operator opens their own counter | 200; `counter.status = OPEN`; DB updated |
| **AC-18** | Operator acts on another operator's counter (BR-04) | 403 `FORBIDDEN` |

---

## F-05: Call Next Customer & Mark Served

### Feature Description

**Call Next:** Operator advances the queue by calling the next WAITING customer.
The ticket becomes IN_SERVICE and `counter.currentServing` increments.
Cannot call next if a customer is already IN_SERVICE (BR-03).

**Mark Served:** Operator marks the current IN_SERVICE customer as SERVED.
After marking served, the operator can call the next customer.

**Linked requirements:** FR-04, FR-05, BR-03, BR-04

### UI Behavior

- "📢 Call Next Customer" button: enabled only when counter is OPEN
  - On success: banner shows "Now serving #N"
  - On failure (BR-03): banner shows "Current customer not yet served"
- "✅ Mark as Served" button: enabled only when counter is OPEN
  - On success: banner shows "Ticket marked as SERVED"

### API Specification

#### POST /api/counters/:id/next
```
Response 200:
  { "ticket": { "id": number, "queueNumber": number, "status": "IN_SERVICE", ... } }

Response 400 (BR-03): { "error": "Current customer not yet served",
                        "code": "CUSTOMER_IN_SERVICE" }
Response 403 (BR-04): { "error": "Not your counter", "code": "FORBIDDEN" }
Response 404:          { "error": "No waiting customers", "code": "QUEUE_EMPTY" }
```

#### POST /api/counters/:id/serve
```
Response 200:
  { "ticket": { "id": number, "status": "SERVED" } }

Response 403 (BR-04): { "error": "Not your counter", "code": "FORBIDDEN" }
Response 404:          { "error": "No customer in service", "code": "NO_IN_SERVICE" }
```

### Data

**Call Next — atomic transaction:**
```
prisma.$transaction([
  queueTicket.update(nextTicket.id → status: IN_SERVICE),
  counter.update(id → currentServing: nextTicket.queueNumber)
])
```

Using `$transaction` ensures `currentServing` and ticket status stay consistent under concurrent requests.

### Acceptance Criteria

| AC ID | Scenario | Expected Outcome |
|-------|----------|-----------------|
| **AC-15** | Operator calls next with WAITING customers; no IN_SERVICE exists | 200; ticket → IN_SERVICE; `currentServing` incremented |
| **AC-16** | Operator calls next while one is already IN_SERVICE (BR-03) | 400 `CUSTOMER_IN_SERVICE`; queue unchanged |
| **AC-17** | Operator marks current IN_SERVICE customer as served | 200; ticket → SERVED |
| **AC-18** | Operator acts on another operator's counter (BR-04) | 403 `FORBIDDEN` (covers both /next and /serve) |

### Software Test Specification (STS)

| Test ID | Linked AC | Level | Precondition | Action | Expected Result |
|---------|-----------|-------|-------------|--------|-----------------|
| TEST-14 | AC-14 | Integration (API) | Counter CLOSED; Operator1 logged in | PATCH `/api/counters/1/status` `{ status: "OPEN" }` | 200; DB `status = OPEN` |
| TEST-15 | AC-15 | Integration (API) | 1 WAITING ticket; no IN_SERVICE | POST `/api/counters/1/next` | 200; ticket → IN_SERVICE; `currentServing` incremented |
| TEST-16 | AC-16 | Integration (API) | 1 IN_SERVICE + 1 WAITING ticket | POST `/api/counters/1/next` | 400 `CUSTOMER_IN_SERVICE` |
| TEST-17 | AC-17 | Integration (API) | 1 IN_SERVICE ticket | POST `/api/counters/1/serve` | 200; ticket → SERVED |
| TEST-18 | AC-18 | Integration (API) | Operator2 tries counter1 (owned by Operator1) | POST `/api/counters/1/next` | 403 `FORBIDDEN` |

**Test file:** `server/tests/sprint-1/counters.test.ts`

> **TDD note:** TEST-16 (BR-03) and TEST-18 (BR-04) written before implementation. Both initially failed; enforcement added to route handler; both now pass.


## Issue #1 contract amendment — authenticated counter selection

Added 2026-11-15 before implementing this correction. This amendment does not
claim that the original application was developed with TDD.

`GET /api/counters/my-counter` requires the JWT cookie and OPERATOR role.
The server selects Counter by the authenticated user ID (`operatorId`), never
by a caller-provided ID or the first item on the public board.

- 200: `{ "counter": { "id": number, "name": string, "status": "OPEN" | "CLOSED", "currentServing": number } }`
- 401: `UNAUTHORIZED` for missing/invalid authentication.
- 403: `FORBIDDEN` for CUSTOMER role.
- 404: `NO_ASSIGNED_COUNTER` when this operator has no assignment.
- 500: `COUNTER_LOAD_FAILED` with a generic error; no database details.
- Public `/api/board` continues exposing only id, name, status, currentServing.

The dashboard displays loading separately from an unassigned counter. Failed
requests show an error and a retry button, without actionable stale counter data.
Changing session cancels an outstanding counter read. Operator controls use the
returned counter ID; all three write endpoints retain their ownership checks.

### Acceptance criteria and test design

| Test group | Linked requirement | Expected evidence |
|---|---|---|
| API assignment | F-05/F-06, BR-04 | Operator1 gets A; Operator2 gets B, even if a query supplies another operator ID |
| API authentication | F-04, BR-04 | Anonymous/invalid cookie 401; customer 403; unassigned operator 404 |
| API ownership | AC-18 | Each operator receives 403 on status, next and serve for the other counter; no DB changes |
| API privacy/errors | BR-04 | Exact public response fields; simulated DB failure returns generic 500 |
| UI assignment/actions | F-05/F-06 | Both accounts display their assigned counter and send open/close, next, serve to that ID |
| UI load states | F-05/F-06 | Loading, no assignment, HTTP error and network failure are distinguishable; retry succeeds |
| UI session change | F-04, BR-04 | A delayed counter response after logout cannot leak into a subsequent operator session |

Regression files: `server/tests/sprint-1/my-counter.test.ts` and
`client/src/operator-counter.test.tsx`. Run database tests only on a disposable
isolated database seeded with the demo fixtures. Existing tests delete tickets.
The initial failing regression run and final results will be recorded in
`docs/sprints/sprint-1/issue-1-verification.md`.
