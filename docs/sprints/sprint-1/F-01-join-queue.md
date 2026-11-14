# Part E — Feature Engineering Contract: F-01 Join Queue

> **Sprint 1** | Linked: FR-01, BR-01, BR-02 | File: `docs/sprints/sprint-1/F-01-join-queue.md`
> Version history: v1.0 — initial contract (before implementation)

---

## Feature Description

Customer selects an open counter and joins its queue.
System creates a `QueueTicket` with status `WAITING` and assigns the next sequential queue number.

**Linked requirements:** FR-01, BR-01 (no duplicate), BR-02 (no closed counter)

---

## UI Behavior

- Customer Dashboard shows a table of all counters with status (OPEN/CLOSED) and current serving number
- "Join" button is **disabled** (UI hint) for CLOSED counters or when customer already has an active ticket
- Server enforces these rules regardless of UI state
- On success: success banner showing queue number; ticket info panel updates
- On failure: error banner with server error message

---

## API Specification

### POST /api/queues/join
```
Request:  { counter_id: number }

Response 201:
  { "ticket": { "id": number, "queueNumber": number, "status": "WAITING",
                "customerId": number, "counterId": number, "createdAt": string } }

Response 400 (BR-01): { "error": "You already have an active ticket for this queue",
                        "code": "DUPLICATE_TICKET" }
Response 400 (BR-02): { "error": "Counter is closed", "code": "COUNTER_CLOSED" }
Response 400:          { "error": "counter_id is required", "code": "MISSING_FIELDS" }
Response 401:          { "error": "Unauthorized",           "code": "UNAUTHORIZED" }
Response 403:          { "error": "Forbidden",              "code": "FORBIDDEN" }
Response 404:          { "error": "Counter not found",      "code": "COUNTER_NOT_FOUND" }
```

---

## Data

**Queue number assignment:**
```sql
SELECT MAX(queueNumber) FROM QueueTicket WHERE counterId = :id
-- next = MAX + 1 (or 1 if no tickets exist)
```

**BR-01 duplicate check:**
```sql
SELECT * FROM QueueTicket
WHERE customerId = :cid AND counterId = :counterId
AND status IN ('WAITING', 'IN_SERVICE')
LIMIT 1
```

---

## Acceptance Criteria

| AC ID | Scenario | Expected Outcome |
|-------|----------|-----------------|
| **AC-06** | Customer joins an open counter with no existing active ticket | 201; ticket created with `status: WAITING` and unique `queueNumber` |
| **AC-07** | Customer joins same counter with existing WAITING ticket (BR-01) | 400 `DUPLICATE_TICKET`; no second ticket stored in DB |
| **AC-07b** | Customer joins a **different** counter (no existing ticket there) | 201; allowed — BR-01 is per-counter |
| **AC-08** | Customer joins a CLOSED counter (BR-02) | 400 `COUNTER_CLOSED` |

---

## Software Test Specification (STS)

| Test ID | Linked AC | Level | Precondition / Input | Action | Expected Result |
|---------|-----------|-------|---------------------|--------|-----------------|
| TEST-06 | AC-06 | Integration (API) | Customer logged in; counter OPEN; no existing ticket | POST `/api/queues/join` `{ counter_id: 1 }` | 201; `QueueTicket` row created with `status: WAITING` |
| TEST-07 | AC-07 | Integration (API) | Customer has WAITING ticket for counter 1 | POST `/api/queues/join` `{ counter_id: 1 }` | 400 `DUPLICATE_TICKET`; DB still has 1 active ticket |
| TEST-07b | AC-07b | Integration (API) | Customer has ticket for counter 1 only | POST `/api/queues/join` `{ counter_id: 2 }` (OPEN) | 201; second ticket created for different counter |
| TEST-08 | AC-08 | Integration (API) | Counter status = CLOSED | POST `/api/queues/join` `{ counter_id: 1 }` | 400 `COUNTER_CLOSED` |

**Test file:** `server/tests/sprint-1/queues.test.ts`

> **TDD note:** TEST-07 was written first (expected to fail), then BR-01 check added to route handler (now passes). Commit sequence visible in Git history.

