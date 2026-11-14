# Part B — Feature Inventory

> **Points:** 10 (combined with traceability.md) | **Artifact:** `docs/features.md`

---

## Feature List

| ID | Feature | Description | Key Business Rules | Dependencies | Planned Sprint |
|----|---------|-------------|-------------------|--------------|----------------|
| **F-01** | Join Queue | Customer joins an open counter queue and receives a WAITING ticket with a unique queue number | BR-01, BR-02 | F-04 (auth), counter must be OPEN | Sprint 1 |
| **F-02** | View Queue Status | Customer views their active ticket, current serving number, and position (how many ahead) | — | F-01 | Sprint 1 |
| **F-03** | Cancel Queue Ticket | Customer cancels their own WAITING ticket | Cannot cancel IN_SERVICE ticket | F-01 | Sprint 1 |
| **F-04** | Authentication (Login / Logout) | Login and logout for Customer and Operator; JWT issuance via HTTP-only cookie | — | — | Sprint 1 |
| **F-05** | Operator — Call Next / Mark Served | Operator calls next customer (advances serving number); marks current IN_SERVICE ticket as SERVED | BR-03, BR-04 | F-04, F-06 | Sprint 1 |
| **F-06** | Operator — Open / Close Counter | Operator opens or closes their assigned counter; closed counter rejects new joins | BR-04 | F-04 | Sprint 1 |
| **F-07** | Public Queue Board | Displays all counters and their current serving numbers; no authentication required | — | F-05, F-06 | Sprint 1 |

---

## Feature Dependencies

```
F-04 (Auth)
  ├── F-01 (Join Queue)
  │     ├── F-02 (View Status)
  │     └── F-03 (Cancel Ticket)
  ├── F-05 (Call Next / Serve)
  └── F-06 (Open / Close Counter)
        └── F-07 (Public Board) ← also readable without auth
```

---

## Sprint Coverage

| Sprint | Features | Goal |
|--------|---------|------|
| Sprint 1 | F-01, F-02, F-03, F-04, F-05, F-06, F-07 | Core vertical slice with auth, queue management, and role enforcement |
| Sprint 2 | F-08 (Skip/No-show), F-09 (Queue category routing), BR-05 (Daily reset) | Core expansion |
| Sprint 3 | F-10 (Analytics), Docker, CI/CD, GCP deployment | Product hardening and deployment |

