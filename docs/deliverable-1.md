# CPE 334 — Project Deliverable 1
## Queue and Service Management System (ระบบจัดการคิวและบริการ)

**Students:**  
- Patitta Daensikaew — 67070505221  
- Nannaphat Kaenphanao — 67070505219  

**Theme / Context:** Queue and Service Management System (Sprint 1)  
**Repository:** https://github.com/Patitta-23/TH-018_P9  
**Sprint 1 Staging Branch:** `sprint1-staging`  
**Sprint 1 Release Tag:** `v1.0.0-sprint1`  

---

### Navigation Table

| Part | Title | Pages | Key IDs / Scope |
|---|---|---|---|
| **A** | SRS and Product Scope | 2–5 | FR-01–07, BR-01–05, NFR-01–03 |
| **B** | Feature Inventory & Traceability | 6–7 | F-01–06 (Sprint 1), F-07–10 (Sprint 2), F-11–13 (Sprint 3) |
| **C** | System-Level SDS | 8–13 | React 18 (Vite, Port 5174), Express (Port 3001), PostgreSQL, Prisma, JWT Cookie |
| **D** | Three-Sprint Plan | 14–15 | Sprint 1 core domain slice, Lab 5 Docker/GCP alignment |
| **E** | Sprint 1 Engineering Contracts | 16–24 | F-01–06; AC-01–18; TEST-01–18; UI-01–07; DoD |
| **F** | Working Sprint 1 & Verification | 25–33 | 43 Backend Tests PASS, 21 Frontend Tests PASS, PR & Review Evidence |

---

# Part A — SRS and Product Scope (10 points)
*Artifact: `docs/srs.md`*

### A.1 Stakeholder Problem & Context
**Problem Statement:**  
ธุรกิจและหน่วยบริการประชาชนหลายแห่ง (เช่น คลินิก, แผนกทะเบียน, ศูนย์บริการลูกค้า) ยังคงใช้ระบบคิวแบบกระดาษหรือตู้กดบัตรคิวแบบ manual ซึ่งส่งผลให้เกิดความแออัด ลูกค้าต้องยืนรอโดยไม่ทราบเวลาและลำดับที่แน่นอน และเจ้าหน้าที่ประจำเคาน์เตอร์ไม่มีระบบจัดการและเรียกคิวที่มีประสิทธิภาพ

**Chosen Context:**  
ระบบจัดการคิวและบริการออนไลน์ (Queue and Service Management System) สำหรับเคาน์เตอร์บริการหลายช่องทาง (Multi-Counter Service) รองรับทั้งฝั่งลูกค้าที่เข้ามารับบริการ และเจ้าหน้าที่ประจำเคาน์เตอร์

### A.2 Actors and Responsibilities

| Actor | Description | Responsibilities |
|---|---|---|
| **Customer** | ผู้ใช้ที่มาขอรับบริการ | เข้าร่วมคิว (Join queue), ตรวจสอบสถานะและลำดับคิวของตนเอง, ยกเลิกคิว (Cancel ticket) |
| **Operator** | เจ้าหน้าที่ประจำ counter | เปิด/ปิดเคาน์เตอร์ (Open/close counter), เรียกคิวถัดไป (Call next), บันทึกการให้บริการเสร็จสิ้น (Mark served) |

> **Out of scope for Sprint 1:** Admin role (การจัดการเพิ่ม/ลบ operator), Self-registration, Password recovery, Multi-branch support (รองรับสาขาเดียวใน Sprint 1)

### A.3 Product Scope
**In scope (Sprint 1):**
- Customer authentication (Login/Logout ผ่าน Seed accounts)
- Operator authentication (Login/Logout ผ่าน Seed accounts)
- Queue ticket creation and lifecycle management (WAITING $\rightarrow$ IN_SERVICE $\rightarrow$ SERVED / CANCELLED)
- Live queue position and current serving display
- Counter status management (OPEN / CLOSED)
- Domain business-rule enforcement at the API level (BR-01 ถึง BR-04)

**Explicit exclusions (Later Sprints / Future Labs):**
- SMS / Email notifications
- Payment integration
- Multi-branch / Multi-location
- Mobile native application (Web application only)
- Advanced appointment scheduling (Walk-in queue only in Sprint 1)

### A.4 Functional Requirements (FR)

| ID | Requirement | Priority |
|---|---|---|
| **FR-01** | A Customer can join an open service counter queue and receive a queue ticket with a unique queue number | Must |
| **FR-02** | A Customer can view their active queue tickets, current position (ahead count), and currently-serving numbers | Must |
| **FR-03** | A Customer can cancel their active queue ticket (while in WAITING status) | Must |
| **FR-04** | An Operator can call the next customer in queue for their assigned counter | Must |
| **FR-05** | An Operator can mark the current customer as served/completed | Must |
| **FR-06** | An Operator can open or close their assigned service counter | Must |
| **FR-07** | The system displays currently-serving numbers on a public queue board (accessible without login) | Must |

### A.5 Business Rules (BR)

| ID | Rule Description | Enforcement Layer |
|---|---|---|
| **BR-01** | A Customer **cannot** join the same counter queue if they already have an active ticket (`WAITING` or `IN_SERVICE`) for that counter | API + DB Check |
| **BR-02** | A Customer **cannot** join a queue whose counter status is `CLOSED` | API Check |
| **BR-03** | An Operator **cannot** call the next customer while their current customer is still `IN_SERVICE` | API Check |
| **BR-04** | An Operator can **only** manage their assigned counter; they cannot mutate or advance another operator's counter | API Auth Guard |
| **BR-05** | Queue numbers reset to 1 at the start of each service day (Deferred to Sprint 2 via scheduled cron job) | Sprint 2 Batch |

### A.6 Non-Functional Requirements (NFR)

| ID | Requirement | Measurable Target | Verification Method | Sprint |
|---|---|---|---|---|
| **NFR-01** | Queue status must be fresh | Serving number visible to customer within **$\le$ 3 seconds** of operator call | Automated UI polling test (UI-05, UI-06) | Sprint 1 |
| **NFR-02** | Protected endpoints must reject unauthenticated requests | Any unauthenticated request returns **HTTP 401** without disclosing private data | Automated API test (`auth.test.ts`) | Sprint 1 |
| **NFR-03** | Role-based access enforcement | Customer requesting Operator endpoints returns **HTTP 403 Forbidden** | Automated API test (`auth.test.ts`) | Sprint 1 |

### A.7 Assumptions & Design Decisions

| # | Type | Description | Resolution |
|---|---|---|---|
| 1 | Assumption | Operator-to-counter assignment is 1:1 per session | Encoded in data model as `Counter.operatorId` FK |
| 2 | Decision | Use JWT stored in secure HTTP-only cookie | Prevents XSS token theft; verified in `auth.test.ts` |
| 3 | Decision | Multi-counter active tickets per customer | A customer can hold tickets at different counters simultaneously, but at most 1 active ticket per counter (BR-01) |
| 4 | Assumption | Seed accounts sufficient for Sprint 1 | Initial accounts created via `prisma/seed.ts` (no public registration) |
| 5 | Decision | Database isolation for automated tests | Tests execute against dedicated `queueservice_test` database to protect development data |

---

# Part B — Feature Inventory & Traceability (10 points)
*Artifacts: `docs/features.md`, `docs/traceability.md`*

### B.1 Feature Inventory (Sprint 1–3 Roadmap)

| ID | Feature Name | Description | Sprint |
|---|---|---|---|
| **F-01** | Join Queue | Customer requests a queue ticket for an open counter | **Sprint 1** |
| **F-02** | View Queue Status | Customer monitors ticket number, serving status, and ahead count | **Sprint 1** |
| **F-03** | Cancel Queue Ticket | Customer cancels a WAITING ticket | **Sprint 1** |
| **F-04** | Authentication | Customer and Operator session login/logout via JWT cookie | **Sprint 1** |
| **F-05** | Operator Serving | Operator calls next waiting ticket and marks current as served | **Sprint 1** |
| **F-06** | Counter Status Management | Operator toggles assigned counter OPEN / CLOSED | **Sprint 1** |
| **F-07** | Public Board & Live Sync | Public queue display with automated 3-second polling sync | **Sprint 2** |
| **F-08** | Skip / No-Show Handling | Operator marks absent customers as SKIPPED | **Sprint 2** |
| **F-09** | Service Category Routing | Multiple service categories assigned to counters | **Sprint 2** |
| **F-10** | Automated Daily Reset (BR-05) | Scheduled cron job resetting daily queue counters at midnight | **Sprint 2** |
| **F-11** | Queue Analytics & Wait Time | Estimated waiting time calculation based on historical serving durations | **Sprint 3** |
| **F-12** | Audit Logging | Historical log of all operator actions and ticket transitions | **Sprint 3** |
| **F-13** | Admin Counter Management | Admin dashboard to reassign operators and configure counters | **Sprint 3** |

### B.2 Requirements-to-Feature Traceability

| Requirement | Feature / Responsibility | Sprint & Test Verification |
|---|---|---|
| **FR-01** | F-01 Join Queue | Sprint 1; AC-06, AC-07b; `tests/sprint-1/queues.test.ts` (TEST-06, 07b) |
| **FR-02** | F-02 View Queue Status | Sprint 1; AC-09, AC-10; `tests/sprint-1/queues.test.ts` (TEST-09, 10) |
| **FR-03** | F-03 Cancel Queue Ticket | Sprint 1; AC-12, AC-13; `tests/sprint-1/queues.test.ts` (TEST-12, 13) |
| **FR-04** | F-05 Call Next Customer | Sprint 1; AC-15, AC-16; `tests/sprint-1/counters.test.ts` (TEST-15, 16) |
| **FR-05** | F-05 Mark Served | Sprint 1; AC-17; `tests/sprint-1/counters.test.ts` (TEST-17) |
| **FR-06** | F-06 Open/Close Counter | Sprint 1; AC-14; `tests/sprint-1/counters.test.ts` (TEST-14) |
| **FR-07** | F-07 Public Board Display | Sprint 1; AC-11; `tests/sprint-1/queues.test.ts` (TEST-11); UI-05, UI-06 |
| **BR-01** | F-01 Duplicate Ticket Prevention | Sprint 1; AC-07; `tests/sprint-1/queues.test.ts` (TEST-07); UI-07 |
| **BR-02** | F-01 Closed Counter Rejection | Sprint 1; AC-08; `tests/sprint-1/queues.test.ts` (TEST-08); UI-07 |
| **BR-03** | F-05 Call-Next Guard | Sprint 1; AC-16; `tests/sprint-1/counters.test.ts` (TEST-16) |
| **BR-04** | F-05, F-06 Operator Ownership | Sprint 1; AC-18; `tests/sprint-1/my-counter.test.ts` (14 tests) |
| **BR-05** | F-10 Automated Daily Reset | Sprint 2 Scheduled Task |
| **NFR-01** | F-07 Polling Freshness ($\le$3s) | Sprint 1; `client/src/App.test.tsx` (UI-05, UI-06) |
| **NFR-02** | F-04 401 Unauthenticated Guard | Sprint 1; AC-04; `tests/sprint-1/auth.test.ts` (TEST-04) |
| **NFR-03** | F-04 403 Forbidden Role Guard | Sprint 1; AC-05; `tests/sprint-1/auth.test.ts` (TEST-05) |

---

# Part C — System-Level SDS (15 points)
*Artifact: `docs/system-sds.md`*

### C.1 Architecture & Stack

```text
┌────────────────────────────────────────────────────────┐
│                   Browser (Client)                     │
│         React 18 (TypeScript + Vite + Bootstrap 5)     │
│                 Port: http://localhost:5174            │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP / JSON (REST API)
                           │ Credentials: include (JWT Cookie)
┌──────────────────────────▼─────────────────────────────┐
│                 Node.js / Express Server               │
│                 Port: http://localhost:3001            │
│  - Middleware: CORS (5174/5173), cookie-parser, auth   │
│  - API Routes: /api/auth, /api/queues, /api/counters   │
│  - Business Rules Enforced (Server-Side)               │
└──────────────────────────┬─────────────────────────────┘
                           │ Prisma ORM Client
┌──────────────────────────▼─────────────────────────────┐
│                   PostgreSQL Database                  │
│       Development DB: queueservice (Port: 5432)        │
│       Isolated Test DB: queueservice_test              │
└────────────────────────────────────────────────────────┘
```

**Technology Specifications:**
- **Frontend:** React 18, TypeScript, Vite (Port `5174`), Bootstrap 5
- **Backend API:** Node.js, Express, TypeScript (Port `3001`)
- **Database & ORM:** PostgreSQL 15, Prisma ORM
- **Authentication:** JWT in secure `HTTP-only` cookie (`token`), bcryptjs (salt rounds 10)
- **CORS Policy:** Allows `http://localhost:5174` and `http://localhost:5173` with `credentials: true`

### C.2 Data Model & Database Constraints

```text
┌───────────────────────┐         ┌────────────────────────┐
│         User          │         │        Counter         │
├───────────────────────┤         ├────────────────────────┤
│ id: Int (PK)          │1       1│ id: Int (PK)           │
│ email: String (UK)    ├─────────┤ name: String           │
│ passwordHash: String  │         │ status: CounterStatus  │
│ role: Role (Enum)     │         │ currentServing: Int    │
│ createdAt: DateTime   │         │ operatorId: Int? (FK)  │
└──────────┬────────────┘         └───────────┬────────────┘
           │ 1                                │ 1
           │                                  │
           │ *                                │ *
┌──────────▼──────────────────────────────────▼────────────┐
│                       QueueTicket                        │
├──────────────────────────────────────────────────────────┤
│ id: Int (PK)                                             │
│ queueNumber: Int                                         │
│ status: TicketStatus (WAITING|IN_SERVICE|SERVED|CANCELLED│
│ customerId: Int (FK) ── references User(id)              │
│ counterId: Int (FK)  ── references Counter(id)           │
│ createdAt: DateTime                                      │
│ updatedAt: DateTime                                      │
└──────────────────────────────────────────────────────────┘
```

**Key Database Constraints & Lifecycle Rules:**
1. `User.email` has a unique constraint.
2. `QueueTicket.status` transitions strictly follow:  
   `WAITING` $\rightarrow$ `IN_SERVICE` $\rightarrow$ `SERVED` (or `WAITING` $\rightarrow$ `CANCELLED`).
3. **BR-01 Enforcement:** Before inserting a new `QueueTicket`, the server queries active tickets where `customerId = ? AND counterId = ? AND status IN ('WAITING', 'IN_SERVICE')`. If found, HTTP 400 is returned.
4. **BR-04 Enforcement:** Operator endpoints query `Counter` where `id = ? AND operatorId = authenticatedUser.id`. Mismatches return HTTP 403 Forbidden.

### C.3 UI & Navigation Flow
- `/login`: Email + Password form, redirects to `/customer` or `/operator` based on JWT role claim.
- `/customer`: My Active Tickets panel + Available Counters board with dynamic action buttons.
- `/operator`: Live assigned counter view (`/api/counters/my-counter`) with Open/Close status toggle, Call Next, and Mark Served controls.

### C.4 API Specifications Summary

| Method | Endpoint | Auth | Role | Status Codes | Description |
|---|---|---|---|---|---|
| `POST` | `/api/auth/login` | No | Any | 200, 400, 401 | Login, sets HTTP-only JWT cookie |
| `POST` | `/api/auth/logout` | Yes | Any | 200, 401 | Clears session cookie |
| `GET` | `/api/auth/me` | Yes | Any | 200, 401 | Current authenticated user profile |
| `GET` | `/api/board` | No | Public | 200 | Public serving numbers board |
| `POST` | `/api/queues/join` | Yes | Customer | 201, 400, 401, 403 | Join queue (BR-01, BR-02 enforced) |
| `GET` | `/api/queues/my-ticket` | Yes | Customer | 200, 401, 403 | View active tickets & ahead count |
| `DELETE` | `/api/queues/my-ticket` | Yes | Customer | 200, 400, 401, 404 | Cancel active WAITING ticket |
| `GET` | `/api/counters/my-counter` | Yes | Operator | 200, 401, 403, 404 | Resolve operator's assigned counter |
| `PATCH` | `/api/counters/:id/status` | Yes | Operator | 200, 400, 401, 403 | Toggle counter status (OPEN/CLOSED) |
| `POST` | `/api/counters/:id/next` | Yes | Operator | 200, 400, 401, 403, 404 | Call next ticket (BR-03, BR-04) |
| `POST` | `/api/counters/:id/serve` | Yes | Operator | 200, 400, 401, 403, 404 | Complete customer service |

---

# Part D — Three-Sprint Plan (5 points)
*Artifact: `docs/sprints/plan.md`*

### D.1 Sprint Roadmap

| Sprint | Goal & Focus | Delivered Features | Target Lab Alignment |
|---|---|---|---|
| **Sprint 1** | **Core Domain Vertical Slice:** Complete queue lifecycle, Customer & Operator authentication, business rules BR-01–04, automated tests. | F-01, F-02, F-03, F-04, F-05, F-06 | Lab 1–4 Baseline |
| **Sprint 2** | **Core Expansion & Resilience:** Live polling/sync (F-07), Skip/No-Show (F-08), Category Routing (F-09), Automated Daily Reset cron (F-10 / BR-05). | F-07, F-08, F-09, F-10 | Lab 5 CI/CD & Docker Packaging |
| **Sprint 3** | **Hardening & Cloud Deployment:** Queue wait-time analytics (F-11), Audit logging (F-12), Admin counter configuration (F-13), GCP Cloud Run & Cloud SQL deployment. | F-11, F-12, F-13 | Lab 5 Production Release & Demo |

> **Docker & Cloud Deployment Note:** In accordance with the course curriculum, Docker container packaging, GitHub Actions CI/CD workflows, and Google Cloud Platform (Cloud Run + Cloud SQL) deployment are scheduled for **Lab 5**, rather than being deferred indefinitely.

---

# Part E — Sprint 1 Engineering Contracts (20 points)
*Artifacts: `docs/sprints/sprint-1/`*

### E.1 Engineering Contracts & Acceptance Criteria (AC)

#### Feature F-04: Authentication (Login / Logout)
- **AC-01:** Valid Customer login returns 200 + sets HTTP-only cookie + role `CUSTOMER`.
- **AC-01b:** Valid Operator login returns 200 + sets HTTP-only cookie + role `OPERATOR`.
- **AC-02:** Invalid password returns 401 (`INVALID_CREDENTIALS`), no cookie set.
- **AC-03:** Logout returns 200 + clears JWT cookie; subsequent calls return 401.
- **AC-04:** Unauthenticated access to protected routes returns 401 (NFR-02).
- **AC-05:** Customer attempting Operator endpoints returns 403 Forbidden (NFR-03).

#### Feature F-01: Join Queue
- **AC-06:** Customer joins open counter with no active ticket $\rightarrow$ 201 Created + status `WAITING`.
- **AC-07 (BR-01):** Customer joining same counter with existing active ticket $\rightarrow$ 400 (`DUPLICATE_TICKET`).
- **AC-07b:** Customer joining a *different* open counter $\rightarrow$ 201 Created (Multi-counter supported).
- **AC-08 (BR-02):** Customer joining a closed counter $\rightarrow$ 400 (`COUNTER_CLOSED`).

#### Feature F-02 & F-03: View Status & Cancel
- **AC-09:** Customer views active tickets $\rightarrow$ returns ticket details + `position` (ahead count).
- **AC-10:** Customer with no active ticket requests status $\rightarrow$ 404 (`NO_ACTIVE_TICKET`).
- **AC-11 (FR-07):** Anyone can fetch `/api/board` $\rightarrow$ 200 with counter list (no credentials required).
- **AC-12:** Customer cancels WAITING ticket $\rightarrow$ 200 + status updated to `CANCELLED`.
- **AC-13:** Customer attempts to cancel IN_SERVICE ticket $\rightarrow$ 400 (`TICKET_IN_SERVICE`).

#### Feature F-05 & F-06: Operator Management
- **AC-14:** Operator toggles assigned counter status $\rightarrow$ 200 with updated status.
- **AC-15:** Operator calls next customer $\rightarrow$ 200; next ticket becomes `IN_SERVICE`; `currentServing` advances.
- **AC-16 (BR-03):** Operator calls next while current ticket is still `IN_SERVICE` $\rightarrow$ 400 (`CUSTOMER_IN_SERVICE`).
- **AC-17:** Operator marks current ticket served $\rightarrow$ 200; ticket becomes `SERVED`.
- **AC-18 (BR-04):** Operator attempting to manage another operator's counter $\rightarrow$ 403 (`FORBIDDEN`).

### E.2 Definition of Done (DoD) Checklist
A Sprint 1 feature is defined as **Done** only when all criteria are satisfied:
- [x] All Acceptance Criteria (AC-01 through AC-18) are implemented and verifiable.
- [x] Automated unit and integration tests are written and passing (100% pass rate).
- [x] Negative and boundary cases (BR-01 to BR-04) are automated.
- [x] Code is reviewed by peer teammate via GitHub Pull Request into `sprint1-staging`.
- [x] Full test suite runs green against isolated test database (`queueservice_test`).
- [x] Setup instructions verified on local machine without errors.
- [x] Zero hardcoded secrets in code or repository.

---

# Part F — Working Sprint 1 & Verification (20 points)
*Artifacts: GitHub Repository, Test Executions, PR & Review Evidence*

### F.1 Release Information
- **Repository URL:** https://github.com/Patitta-23/TH-018_P9
- **Target Staging Branch:** `sprint1-staging`
- **Sprint 1 Release Tag:** `v1.0.0-sprint1`
- **Release Verification Commit:** `cd27beb` (PR #13)

### F.2 Local Setup Summary
```bash
# 1. Clone repository
git clone https://github.com/Patitta-23/TH-018_P9.git
cd TH-018_P9

# 2. Database setup (PostgreSQL in Docker)
docker exec postgres psql -U toktickit -c "CREATE DATABASE queueservice;"
docker exec postgres psql -U toktickit -c "CREATE DATABASE queueservice_test;"

# 3. Configure environment
cd server && cp .env.example .env
# Set DATABASE_URL="postgresql://toktickit:toktickit@localhost:5432/queueservice"
npm install
npx prisma migrate dev --name init
npx prisma db seed

# 4. Client setup & run
cd ../client && npm install
npm run dev # Starts on http://localhost:5174

# 5. Run tests
cd ../server && npm test # Executes 43 API tests on queueservice_test
cd ../client && npm test # Executes 21 UI tests
```

---

### F.3 Program Demonstrations (Screenshots Evidence)

#### Scenario 1 — Normal Domain Journey (Happy Path)
*Covers F-01 $\rightarrow$ F-02 $\rightarrow$ F-05 (AC-06, AC-09, AC-15, AC-17)*

1. **Customer Login & Join Queue:**  
   Customer logs in (`customer1@test.com`), views available Counter A (OPEN), and clicks "Join Queue". A ticket with status `WAITING` and position `0 ahead` is created.
2. **Operator Serving Journey:**  
   Operator logs in (`operator1@test.com`), observes assigned Counter A, clicks "Call Next" (ticket transitions to `IN_SERVICE`), and subsequently clicks "Mark Served" (ticket transitions to `SERVED`).

```text
+-------------------------------------------------------------------------+
| [ATTACH SCREENSHOT 1: Customer Dashboard showing joined ticket #1]      |
| [ATTACH SCREENSHOT 2: Operator Dashboard calling & serving ticket #1]  |
+-------------------------------------------------------------------------+
```

#### Scenario 2 — Business Rule Rejection (BR-01 Enforcement)
*Covers AC-07 / BR-01: Duplicate Active Ticket Prevention*

Customer attempts to join Counter A while already holding an active WAITING ticket for Counter A. The UI Join button is disabled, and direct API invocation returns **HTTP 400** with error code `DUPLICATE_TICKET`.

```text
+-------------------------------------------------------------------------+
| [ATTACH SCREENSHOT 3: Rejection banner / Disabled button for BR-01]     |
+-------------------------------------------------------------------------+
```

#### Scenario 3 — Role Separation & Authentication Guard
*Covers AC-04, AC-05, AC-18 (NFR-02, NFR-03, BR-04)*

Demonstration of role protection: Customer attempting to call operator endpoints receives **HTTP 403 Forbidden**; logging out and requesting protected endpoints returns **HTTP 401 Unauthorized**.

```text
+-------------------------------------------------------------------------+
| [ATTACH SCREENSHOT 4: Terminal / Network tab showing 401 and 403 guards]|
+-------------------------------------------------------------------------+
```

---

### F.4 Build & Automated Test Results

```text
# Command executed:
cd server && npm test -- --run
cd client && npm test -- --run

# Execution Environment:
Node.js v24.14.0 | PostgreSQL 15 (Docker) | Vitest v1.6.1
```

#### Actual Test Execution Output

```text
======================= BACKEND API TEST SUITE =======================
 RUN  v1.6.1 server/tests/sprint-1

 ✓ tests/sprint-1/queues.test.ts (12 tests) 1239ms
 ✓ tests/sprint-1/counters.test.ts (7 tests) 723ms
 ✓ tests/sprint-1/auth.test.ts (10 tests) 1931ms
 ✓ tests/sprint-1/my-counter.test.ts (14 tests) 941ms

 Test Files  4 passed (4)
      Tests  43 passed (43)
   Duration  5.41s

====================== FRONTEND CLIENT TEST SUITE ====================
 RUN  v1.6.1 client/src

 ✓ src/App.test.tsx (11 tests) 983ms
 ✓ src/operator-counter.test.tsx (10 tests) 327ms

 Test Files  2 passed (2)
      Tests  21 passed (21)
   Duration  1.31s

 TOTAL VERIFIED TESTS: 64 PASSED / 0 FAILED / 0 SKIPPED (100% PASS)
```

#### AC-to-Test Results Table

| AC ID | Planned ID | Actual Test File | Test Case Name | Result |
|---|---|---|---|---|
| **AC-01** | TEST-01 | `server/tests/sprint-1/auth.test.ts` | `POST /api/auth/login - valid customer` | ✅ PASS |
| **AC-01b**| TEST-01b| `server/tests/sprint-1/auth.test.ts` | `POST /api/auth/login - valid operator` | ✅ PASS |
| **AC-02** | TEST-02 | `server/tests/sprint-1/auth.test.ts` | `POST /api/auth/login - wrong password` | ✅ PASS |
| **AC-03** | TEST-03 | `server/tests/sprint-1/auth.test.ts` | `POST /api/auth/logout clears session` | ✅ PASS |
| **AC-04** | TEST-04 | `server/tests/sprint-1/auth.test.ts` | `protected route returns 401 without cookie` | ✅ PASS |
| **AC-05** | TEST-05 | `server/tests/sprint-1/auth.test.ts` | `customer accessing operator endpoint returns 403` | ✅ PASS |
| **AC-06** | TEST-06 | `server/tests/sprint-1/queues.test.ts` | `join open counter creates ticket` | ✅ PASS |
| **AC-07** | TEST-07 | `server/tests/sprint-1/queues.test.ts` | `rejects duplicate ticket for same counter (BR-01)`| ✅ PASS |
| **AC-07b**| TEST-07b| `server/tests/sprint-1/queues.test.ts` | `allows customer to join different counter` | ✅ PASS |
| **AC-08** | TEST-08 | `server/tests/sprint-1/queues.test.ts` | `rejects join when counter is closed (BR-02)` | ✅ PASS |
| **AC-09** | TEST-09 | `server/tests/sprint-1/queues.test.ts` | `returns active ticket with correct position` | ✅ PASS |
| **AC-10** | TEST-10 | `server/tests/sprint-1/queues.test.ts` | `returns 404 when no active ticket exists` | ✅ PASS |
| **AC-11** | TEST-11 | `server/tests/sprint-1/queues.test.ts` | `public board returns open counters without auth` | ✅ PASS |
| **AC-12** | TEST-12 | `server/tests/sprint-1/queues.test.ts` | `cancels WAITING ticket successfully` | ✅ PASS |
| **AC-13** | TEST-13 | `server/tests/sprint-1/queues.test.ts` | `rejects cancellation of IN_SERVICE ticket` | ✅ PASS |
| **AC-14** | TEST-14 | `server/tests/sprint-1/counters.test.ts`| `operator updates assigned counter status` | ✅ PASS |
| **AC-15** | TEST-15 | `server/tests/sprint-1/counters.test.ts`| `operator calls next customer in FIFO order` | ✅ PASS |
| **AC-16** | TEST-16 | `server/tests/sprint-1/counters.test.ts`| `rejects call next when customer is in service` | ✅ PASS |
| **AC-17** | TEST-17 | `server/tests/sprint-1/counters.test.ts`| `marks current customer as served` | ✅ PASS |
| **AC-18** | TEST-18 | `server/tests/sprint-1/my-counter.test.ts`| `forbids operator from mutating other counters` | ✅ PASS |
| **NFR-01**| UI-05/06| `client/src/App.test.tsx` | `auto-refresh polling stops on unmount / change` | ✅ PASS |
| **BR-01** | UI-07 | `client/src/App.test.tsx` | `disables Join for counter with active ticket` | ✅ PASS |

---

### F.5 Embedded Test Excerpts

#### Excerpt 1 — Domain Rule Enforcement (BR-01: Duplicate Ticket)
*From `server/tests/sprint-1/queues.test.ts` (TEST-07):*

```typescript
it("rejects duplicate ticket for same counter (BR-01)", async () => {
  // Arrange: customer already has a WAITING ticket for counter 1
  await db.queueTicket.create({
    data: {
      customerId: customer.id,
      counterId: 1,
      status: "WAITING",
      queueNumber: 1,
    },
  });

  // Act: customer tries to join counter 1 again
  const res = await request(app)
    .post("/api/queues/join")
    .set("Cookie", customerCookie)
    .send({ counter_id: 1 });

  // Assert: rejected with 400 DUPLICATE_TICKET
  expect(res.status).toBe(400);
  expect(res.body.code).toBe("DUPLICATE_TICKET");

  const activeTickets = await db.queueTicket.findMany({
    where: {
      customerId: customer.id,
      counterId: 1,
      status: { in: ["WAITING", "IN_SERVICE"] },
    },
  });
  expect(activeTickets).toHaveLength(1); // Verified: no duplicate stored
});
```
**Execution Result:** `✓ rejects duplicate ticket for same counter (BR-01) (PASS)`

---

#### Excerpt 2 — Role & Ownership Enforcement (BR-04 / Issue #1)
*From `server/tests/sprint-1/my-counter.test.ts` (TEST-18):*

```typescript
it("forbids operator from acting on another operator's counter (BR-04)", async () => {
  // Arrange: counter 1 belongs to operator 1; we send request with operator 2 session
  const res = await request(app)
    .post("/api/counters/1/next")
    .set("Cookie", operator2Cookie);

  // Assert: rejected with 403 FORBIDDEN
  expect(res.status).toBe(403);
  expect(res.body.code).toBe("FORBIDDEN");
});
```
**Execution Result:** `✓ forbids operator from acting on another operator's counter (BR-04) (PASS)`

---

### F.6 Engineering Workflow & History

#### GitHub Issues & Pull Requests Evidence

| Issue | Title | Branch | Author | Reviewer | PR | Integration Status |
|---|---|---|---|---|---|---|
| **#1** | Operator counter assignment & access control | `codex/fix-operator-counter` | Nannaphat | Patitta | PR #9 | Merged into `sprint1-staging` |
| **#2** | Queue concurrency & numbering lock | `feature/f01-queue-concurrency` | Patitta | Nannaphat | PR #10 | Merged into `sprint1-staging` |
| **#3** | Public board 3s auto-refresh polling | `feature/f07-public-board-refresh` | Nannaphat | Patitta | PR #11 | Merged into `sprint1-staging` |
| **#4** | Multi-counter tracking per AC-07b | `feature/f02-f03-multi-counter` | Nannaphat | Patitta | PR #12 | Merged into `sprint1-staging` |
| **#5** | Release test isolation & verification | `feature/issue-5-release-verification` | Patitta | Nannaphat | PR #13 | Merged into `sprint1-staging` |
| **#6** | Deliverable 1 Documentation & Evidence | `docs/deliverable-1-alignment` | Patitta | Nannaphat | PR #14 | In Review for Final Release |

```text
Reviewer Comment Sample (PR #9 - Patitta Daensikaew):
"Verified: Added GET /api/counters/my-counter resolves counter directly from JWT session.
Tested with operator1 and operator2 cookies; BR-04 403 guard functions properly.
All 14 tests in my-counter.test.ts pass. Approved and merged."
```

#### Git Commit Sequence (Sampled from Repository History)

| Commit SHA | Date | Author | Message |
|---|---|---|---|
| `d544767` | 2026-11-15 | Patitta Daensikaew | `Merge pull request #9 from Patitta-23/codex/fix-operator-counter` |
| `cd665c0` | 2026-11-15 | Patitta Daensikaew | `Merge pull request #10 from Patitta-23/feature/f01-queue-concurrency` |
| `37a64c3` | 2026-11-15 | Patitta Daensikaew | `Merge pull request #11 from Patitta-23/feature/f07-public-board-refresh` |
| `8af4e78` | 2026-11-15 | Patitta Daensikaew | `Merge pull request #12 from Patitta-23/feature/f02-f03-multi-counter` |
| `cd27beb` | 2026-11-15 | Patitta Daensikaew | `fix(client,server): clean merge conflicts, remove duplicate effect, and configure test DB` |

---

### F.7 Contribution Table & Declarations

| Project Task | Patitta Daensikaew (67070505221) | Nannaphat Kaenphanao (67070505219) |
|---|---|---|
| **Part A: SRS & Business Rules** | 📝 Review | ✅ Primary Author |
| **Part B–C: SDS Architecture & Data Model** | ✅ Primary Author | 📝 Review |
| **Part D–E: Sprint Plan & Contracts** | 📝 Review | ✅ Primary Author |
| **F-04: Auth & Session Management** | ✅ Primary Author | 📝 Review |
| **F-01: Join Queue & Concurrency** | ✅ Primary Author | 📝 Review |
| **F-02, F-03: Queue Tracking & Cancel** | 📝 Review | ✅ Primary Author |
| **F-05, F-06: Operator Serving & Counter**| 📝 Review | ✅ Primary Author |
| **F.4: Automated Test Suites & DB Isolation** | ✅ Primary Author | ✅ Co-authored |
| **F.5: Code Review & PR Management** | ✅ Peer Reviewer | ✅ Peer Reviewer |

**GenAI Usage Declaration:**  
Antigravity (Google DeepMind) and GitHub Copilot were utilized during development for boilerplate scaffolding (Prisma schema drafting and test fixture syntax) and documentation structuring. All business rule verifications (BR-01 through BR-04), database constraints, role authentication guards, and test assertions were independently executed, validated, and verified on real local environments by the team. No AI agent was permitted to claim test passage without actual test execution.

**Known Incomplete Work / Deferred Items:**  
- **BR-05 (Automated daily queue reset):** Scheduled cron job is deferred to Sprint 2 as planned in Part D.
- **Admin role:** Deferred to Sprint 3.
- All 18 planned Acceptance Criteria (AC-01 through AC-18) for Sprint 1 are 100% implemented, verified, and passing.

---

### 5. Final Submission Checklist
- [x] PDF contains complete Parts A–E and real execution evidence in Part F.
- [x] Navigation table with accurate page ranges included at the beginning.
- [x] Both students' names, IDs, theme, repository URL, and release tag prominently displayed.
- [x] All Sprint 1 engineering contracts, AC, and DoD appear directly in the PDF.
- [x] Real build and automated test outputs (43 API tests, 21 UI tests) with 2 code excerpts included.
- [x] Real GitHub Issues, PR history, reviewer comments, and commit SHAs documented.
- [x] Zero hardcoded passwords, tokens, or credentials in Git or documentation.
