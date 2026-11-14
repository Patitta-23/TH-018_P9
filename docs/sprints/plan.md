# Part D — Three-Sprint Plan

> **Points:** 5 | **Artifact:** `docs/sprints/plan.md`

---

## Sprint Overview

| Sprint | Goal | Checkpoint |
|--------|------|-----------|
| **1** | Working domain slice: auth + queue management + role enforcement | Deliverable 1 — 8 Nov 2026 |
| **2** | Core expansion: skip/no-show, queue categories, daily reset | Deliverable 2 — 29 Nov 2026 |
| **3** | Remaining features, integration, hardening, Docker, CI/CD, GCP | 13 Dec 2026 |

---

## Sprint 1 — Core Vertical Slice

**Goal:** Prove the full stack works end-to-end with real authentication, two roles, and enforced business rules.

| Feature ID | Feature | Completion Outcome |
|------------|---------|-------------------|
| F-04 | Authentication (Login/Logout) | JWT cookie issued; role-based routing works |
| F-01 | Join Queue | Customer can join OPEN counter; BR-01, BR-02 enforced |
| F-02 | View Queue Status | Customer sees ticket + position; public board works |
| F-03 | Cancel Queue Ticket | Customer can cancel WAITING ticket |
| F-05 | Operator — Call Next / Mark Served | Operator advances queue; BR-03, BR-04 enforced |
| F-06 | Operator — Open / Close Counter | Operator controls counter availability |
| F-07 | Public Queue Board | Available without login |

**Dependencies:** PostgreSQL running; seed accounts provisioned.
**Sprint 1 Scope Explanation:** This sprint covers the minimum viable vertical slice — a customer can walk through the full domain journey (login → join queue → view position → be served) with real persistence and role enforcement at the API level.

---

## Sprint 2 — Core Expansion

**Goal:** Expand domain with richer queue management and improved operator tools.

| Feature ID | Feature | Dependencies |
|------------|---------|--------------|
| F-08 | Skip / No-show | Operator can skip a WAITING ticket (mark SKIPPED) | Sprint 1 |
| F-09 | Queue category routing | Customer selects service category when joining | Sprint 1 |
| BR-05 | Daily queue number reset | Scheduled job resets `currentServing` and `queueNumber` per counter daily | Sprint 1 |

**Dependencies:** Sprint 1 release on `main`.

---

## Sprint 3 — Hardening & Deployment

**Goal:** Complete remaining features, production quality, Docker, CI/CD, GCP.

| Feature ID | Feature | Dependencies |
|------------|---------|--------------|
| F-10 | Operator analytics dashboard | Queue statistics, avg wait time | Sprint 2 |
| Infra | Docker packaging | Stateless API + externalized DB | Sprint 2 |
| Infra | CI/CD pipeline | GitHub Actions: lint + test + deploy | Sprint 2 |
| Infra | GCP Cloud Run deployment | Docker image deployed to Cloud Run + Cloud SQL | Sprint 3 |

**Dependencies:** Sprint 2 release; Docker + GCP account configured.

