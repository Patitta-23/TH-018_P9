# Part E — Feature Engineering Contract: F-02 View Queue Status & F-03 Cancel Ticket

> **Sprint 1** | F-02: FR-02, FR-07, NFR-01 | F-03: FR-03 | File: `docs/sprints/sprint-1/F-02-F-03-queue-status.md`
> Version history: v1.0 — initial contract (before implementation)

---

## F-02: View Queue Status

### Feature Description

Customer views their active ticket details: queue number, counter name, current serving number, and their position (how many WAITING tickets are ahead of them).

A public queue board also shows all counters and their current serving numbers — accessible without login.

**Linked requirements:** FR-02, FR-07, NFR-01

### UI Behavior

- Customer dashboard shows "My Queue Ticket" panel:
  - Queue number (large, prominent)
  - Counter name and status badge
  - Current serving number
  - Number of people ahead
  - Cancel button (visible only when status = WAITING)
- Refresh button on counter table updates the board
- If no active ticket: show "No active ticket. Join a queue below."

### API Specification

#### GET /api/queues/my-ticket
```
Response 200:
  { "ticket": { "id": number, "queueNumber": number, "status": string,
                "counter": { "id": number, "name": string, "currentServing": number } },
    "position": number }   ← count of WAITING tickets with queueNumber < mine

Response 401: { "error": "Unauthorized",    "code": "UNAUTHORIZED" }
Response 403: { "error": "Forbidden",       "code": "FORBIDDEN" }
Response 404: { "error": "No active ticket","code": "NO_ACTIVE_TICKET" }
```

#### GET /api/board (public, no auth required)
```
Response 200:
  { "counters": [{ "id": number, "name": string,
                   "status": "OPEN"|"CLOSED", "currentServing": number }] }
  Note: operatorId is NOT included (private data excluded)
```

### Acceptance Criteria

| AC ID | Scenario | Expected Outcome |
|-------|----------|-----------------|
| **AC-09** | Customer with active ticket views status | 200; correct `queueNumber`, `currentServing`, `position` |
| **AC-10** | Customer with no active ticket requests status | 404 `NO_ACTIVE_TICKET` |
| **AC-11** | Anyone views public board (no cookie) | 200; counter array; no `operatorId` or private data |

### Software Test Specification (STS)

| Test ID | Linked AC | Level | Precondition | Action | Expected Result |
|---------|-----------|-------|-------------|--------|-----------------|
| TEST-09 | AC-09 | Integration (API) | Customer has WAITING ticket #2; ticket #1 also WAITING (ahead) | GET `/api/queues/my-ticket` | 200; `position: 1` |
| TEST-10 | AC-10 | Integration (API) | No active ticket for customer | GET `/api/queues/my-ticket` | 404 `NO_ACTIVE_TICKET` |
| TEST-11 | AC-11 | Integration (API) | No cookie | GET `/api/board` | 200; counters array; no `operatorId` |

**Test file:** `server/tests/sprint-1/queues.test.ts`

---

## F-03: Cancel Queue Ticket

### Feature Description

Customer cancels their own WAITING ticket. IN_SERVICE tickets cannot be cancelled.
Ticket status changes to CANCELLED; counter's queue continues unaffected.

**Linked requirements:** FR-03

### API Specification

#### DELETE /api/queues/my-ticket
```
Response 200: { "message": "Ticket cancelled" }

Response 400: { "error": "Cannot cancel a ticket that is in service",
               "code": "TICKET_IN_SERVICE" }
Response 401: { "error": "Unauthorized",    "code": "UNAUTHORIZED" }
Response 404: { "error": "No active ticket","code": "NO_ACTIVE_TICKET" }
```

### Data

```sql
UPDATE QueueTicket SET status = 'CANCELLED' WHERE id = :id
```

### Acceptance Criteria

| AC ID | Scenario | Expected Outcome |
|-------|----------|-----------------|
| **AC-12** | Customer cancels their WAITING ticket | 200; ticket `status = CANCELLED` in DB |
| **AC-13** | Customer tries to cancel IN_SERVICE ticket | 400 `TICKET_IN_SERVICE`; ticket status unchanged |

### Software Test Specification (STS)

| Test ID | Linked AC | Level | Precondition | Action | Expected Result |
|---------|-----------|-------|-------------|--------|-----------------|
| TEST-12 | AC-12 | Integration (API) | Customer has WAITING ticket | DELETE `/api/queues/my-ticket` | 200; DB row `status = CANCELLED` |
| TEST-13 | AC-13 | Integration (API) | Customer ticket is IN_SERVICE | DELETE `/api/queues/my-ticket` | 400 `TICKET_IN_SERVICE`; unchanged |

**Test file:** `server/tests/sprint-1/queues.test.ts`

