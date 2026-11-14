# Part A — Software Requirements Specification (SRS)

> **Points:** 10 | **Artifact:** `docs/srs.md`

---

## A.1 Stakeholder Problem & Context

**Problem:**
ธุรกิจและหน่วยบริการหลายแห่ง (เช่น คลินิก ร้านราชการ ศูนย์บริการ) ยังใช้ระบบคิวแบบ manual ซึ่งไม่มีประสิทธิภาพ ลูกค้าต้องรอโดยไม่รู้ว่าต้องรอนานแค่ไหน และเจ้าหน้าที่ไม่มีเครื่องมือจัดการคิวอย่างเป็นระบบ

**Chosen Context:**
ระบบจัดการคิวและบริการออนไลน์สำหรับ service counter ที่มีหลาย counter และหลาย service category ผู้ใช้งาน login ผ่าน web browser เพื่อดำเนินการตามสิทธิ์ของตน

---

## A.2 Actors and Responsibilities

| Actor | Description | Key Responsibilities |
|-------|-------------|---------------------|
| **Customer** | ผู้ใช้ที่มาขอรับบริการ | Join queue, view queue position, cancel ticket |
| **Operator** | เจ้าหน้าที่ประจำ counter | Open/close counter, call next customer, mark served |

---

## A.3 Product Scope

**In scope (Sprint 1):**
- Customer and Operator authentication (login / logout) via JWT
- Customer: join an open queue, view ticket + position, cancel WAITING ticket
- Operator: open/close assigned counter, call next customer, mark current customer as served
- Public queue board (no login required)
- Role-based access control enforced at API level

**Explicit exclusions:**
- Admin role (managing operators / users)
- Self-registration and password recovery
- SMS/email notifications
- Payment integration
- Multi-branch / multi-location support
- Mobile native application (web only)
- Appointment pre-booking (walk-in queue only)
- Docker, CI/CD, GCP deployment (deferred to Lab 5)

---

## A.4 Functional Requirements (FR)

| ID | Requirement | Priority |
|----|-------------|----------|
| **FR-01** | A Customer can join an open service queue and receive a ticket with a unique queue number | Must |
| **FR-02** | A Customer can view their current queue position and the currently-serving number | Must |
| **FR-03** | A Customer can cancel their active WAITING ticket | Must |
| **FR-04** | An Operator can call the next customer in queue (advance serving number) | Must |
| **FR-05** | An Operator can mark the current customer as served/completed | Must |
| **FR-06** | An Operator can open or close their assigned service counter | Must |
| **FR-07** | The system displays currently-serving numbers on a public board (no login required) | Must |

---

## A.5 Business Rules (BR)

| ID | Rule |
|----|------|
| **BR-01** | A Customer **cannot** join the same queue if they already have an active (WAITING or IN_SERVICE) ticket for that counter |
| **BR-02** | A Customer **cannot** join a queue whose counter status is CLOSED |
| **BR-03** | An Operator **cannot** call the next customer while the current customer is still IN_SERVICE |
| **BR-04** | An Operator can only manage the counter assigned to them; acting on another operator's counter returns 403 |
| **BR-05** | Queue numbers reset to 1 at the start of each service day (deferred to Sprint 2) |

---

## A.6 Non-Functional Requirements (NFR)

| ID | Requirement | Measurable Target | Verification Method | Sprint |
|----|-------------|-------------------|---------------------|--------|
| **NFR-01** | Queue status freshness | Serving number visible to customer within ≤ 3 seconds of operator calling next | API response time test + manual check | Sprint 1 |
| **NFR-02** | Unauthenticated request rejection | An unauthenticated request to any `/api/*` protected endpoint returns HTTP 401 **without** returning private data | Automated API test (TEST-04) | Sprint 1 |
| **NFR-03** | Role-based access enforcement | A Customer request to an Operator-only endpoint returns HTTP 403 | Automated API test (TEST-05) | Sprint 1 |

---

## A.7 Assumptions & Design Decisions

| # | Type | Description | Resolution |
|---|------|-------------|------------|
| 1 | Assumption | Each Operator is assigned to exactly one counter per session | Encoded in data model: `Counter.operatorId` unique FK |
| 2 | Decision | Use JWT (stateless) stored in HTTP-only cookie | Simplifies API testing; prevents XSS token theft |
| 3 | Decision | Queue number is a sequential integer per counter (application-level) | Simple and human-readable |
| 4 | Assumption | Seed accounts are sufficient for Sprint 1 (no self-registration required) | Seeded via `prisma/seed.ts` |
| 5 | Question | Should a customer join multiple **different** queues simultaneously? | **Resolved:** Yes — BR-01 applies per-counter, not globally |
| 6 | Decision | Business rules enforced in API layer, not client | Hiding a UI button does not constitute authorization |

