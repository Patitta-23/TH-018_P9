# Part B — Requirements-to-Feature Traceability

> **Points:** 10 (combined with features.md) | **Artifact:** `docs/traceability.md`

---

## Traceability Table

| Requirement | Feature / Responsibility | Sprint & Verification |
|-------------|-------------------------|----------------------|
| FR-01 | F-01 Join Queue | Sprint 1; AC-06, AC-07 / TEST-06, TEST-07 |
| FR-02 | F-02 View Queue Status | Sprint 1; AC-09 / TEST-09 |
| FR-03 | F-03 Cancel Queue Ticket | Sprint 1; AC-12 / TEST-12 |
| FR-04 | F-05 Call Next Customer | Sprint 1; AC-15 / TEST-15 |
| FR-05 | F-05 Mark Served | Sprint 1; AC-17 / TEST-17 |
| FR-06 | F-06 Open/Close Counter | Sprint 1; AC-14 / TEST-14 |
| FR-07 | F-07 Public Queue Board | Sprint 1; AC-11 / TEST-11 |
| BR-01 | F-01 Duplicate ticket prevention | Sprint 1; AC-07 / TEST-07 |
| BR-02 | F-01 Closed counter rejection | Sprint 1; AC-08 / TEST-08 |
| BR-03 | F-05 Call-next guard | Sprint 1; AC-16 / TEST-16 |
| BR-04 | F-05, F-06 Operator ownership | Sprint 1; AC-18 / TEST-18 |
| BR-05 | System responsibility — daily reset | **Sprint 2** (deferred); scheduled job |
| NFR-01 | F-02 Queue status freshness | Sprint 1; manual timing test |
| NFR-02 | System responsibility — auth guard | Sprint 1; AC-04 / TEST-04 |
| NFR-03 | System responsibility — role guard | Sprint 1; AC-05 / TEST-05 |

---

## Coverage Gaps & Approved Changes

| Requirement | Reason Not Covered in Sprint 1 | Planned Sprint |
|-------------|-------------------------------|----------------|
| BR-05 (Daily queue reset) | Requires scheduled job / cron; deferred by design | Sprint 2 |
| Notifications (email/SMS) | Out of scope per SRS exclusions | Not planned |
| Self-registration | Out of scope per SRS exclusions | Not planned |

---

## Uncovered / Later-Sprint Requirements

Requirements in Sprint 2 or later **need a feature/responsibility and sprint allocation now**, but do not yet need fully elaborated feature AC and executable tests.

| Requirement | Planned Feature | Sprint |
|-------------|----------------|--------|
| BR-05 | Scheduled daily reset job | Sprint 2 |
| F-08 Skip/No-show | Operator can skip a customer in queue | Sprint 2 |
| F-09 Queue category routing | Customer selects a service category when joining | Sprint 2 |

