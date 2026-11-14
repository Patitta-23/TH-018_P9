# Part C — System-Level Software Design Specification (SDS)

> **Points:** 15 | **Artifact:** `docs/system-sds.md`

---

## C.1 Architecture & Stack

```
┌──────────────────────────────────────────────────────┐
│                   Browser (Client)                   │
│   React 18 + TypeScript + Vite + Bootstrap 5         │
│   Fetches via /api proxy (Vite dev) or same origin   │
└───────────────────────┬──────────────────────────────┘
                        │ HTTP/JSON (REST)
                        │ Credentials: HTTP-only cookie
┌───────────────────────▼──────────────────────────────┐
│          API Layer — Node.js + Express + TypeScript   │
│  /api/auth/*   /api/queues/*   /api/counters/*        │
│  Business rules enforced here (server-side only)      │
│  Middleware: requireAuth → requireRole                 │
└───────────────────────┬──────────────────────────────┘
                        │ Prisma ORM (type-safe queries)
┌───────────────────────▼──────────────────────────────┐
│          PostgreSQL Database                          │
│  Tables: User, Counter, QueueTicket                   │
└──────────────────────────────────────────────────────┘
```

**Component Responsibilities:**

| Layer | Technology | Responsibility |
|-------|-----------|---------------|
| UI | React 18 + Bootstrap 5 | Render login/customer/operator views; call API; display state |
| API | Express + TypeScript | Validate input, enforce auth, enforce business rules, return JSON |
| Auth Middleware | jsonwebtoken + bcryptjs | Verify JWT cookie; guard routes by role |
| ORM | Prisma 5 | Type-safe queries; migrations; seed |
| DB | PostgreSQL | Persist users, counters, tickets |

> **Business rules are enforced exclusively in the API layer.** The UI may hint at restrictions (e.g., disabled buttons) but removing a UI element does not constitute authorization.

---

## C.2 Data Model

```
User
 ├── id          Int (PK, autoincrement)
 ├── email       String (unique)
 ├── passwordHash String
 ├── role        Enum: CUSTOMER | OPERATOR
 └── createdAt   DateTime

Counter
 ├── id             Int (PK, autoincrement)
 ├── name           String
 ├── status         Enum: OPEN | CLOSED  (default CLOSED)
 ├── currentServing Int (default 0)
 ├── serviceDate    DateTime (default now)
 └── operatorId     Int? (unique FK → User)   ← one Operator per Counter

QueueTicket
 ├── id          Int (PK, autoincrement)
 ├── queueNumber Int
 ├── status      Enum: WAITING | IN_SERVICE | SERVED | CANCELLED
 ├── createdAt   DateTime
 ├── updatedAt   DateTime (@updatedAt)
 ├── customerId  Int (FK → User)
 └── counterId   Int (FK → Counter)
```

**Key Constraints:**
- `User.email` — unique index
- `Counter.operatorId` — unique nullable FK (one-to-one operator assignment)
- BR-01 duplicate prevention: application-level query filtering `status IN (WAITING, IN_SERVICE)` per `(customerId, counterId)`
- `QueueTicket.queueNumber` — application-level sequential integer per counter

**Database Setup:**
- Migrations: `npx prisma migrate dev`
- Seed: `npx prisma db seed` → creates 2 Customer + 2 Operator accounts + 2 Counters
- Seed uses `upsert` — safe to run multiple times without duplicates

---

## C.3 Main Screens / Navigation

| Screen | Route | Accessible by |
|--------|-------|--------------|
| Login | `/` (default) | All (unauthenticated) |
| Customer Dashboard | `/` (after login as CUSTOMER) | Customer |
| Operator Dashboard | `/` (after login as OPERATOR) | Operator |
| Public Queue Board | Available from `/api/board` | Anyone (no login) |

**Shared UI Behavior:**
- Form validation: required fields checked client-side; business rules checked server-side
- Loading states: button disabled + text change while API call in progress
- Error states: `alert-danger` banner with server error message
- Success states: `alert-success` banner with confirmation message
- Empty states: descriptive message ("No active ticket", "No counters available")

---

## C.4 API Conventions

**Base path:** `/api/`
**Format:** JSON (request and response)
**Auth:** JWT stored in HTTP-only cookie (`token`); sent automatically via `credentials: "include"`
**Error response shape:**
```json
{ "error": "Human-readable message", "code": "MACHINE_READABLE_CODE" }
```

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/api/auth/login` | No | — | Validate credentials, issue JWT cookie |
| POST | `/api/auth/logout` | Yes | Any | Clear JWT cookie |
| GET | `/api/auth/me` | Yes | Any | Return current user |
| GET | `/api/board` | No | — | Public serving numbers (FR-07) |
| POST | `/api/queues/join` | Yes | Customer | Join a queue (FR-01) |
| GET | `/api/queues/my-ticket` | Yes | Customer | View ticket + position (FR-02) |
| DELETE | `/api/queues/my-ticket` | Yes | Customer | Cancel ticket (FR-03) |
| PATCH | `/api/counters/:id/status` | Yes | Operator | Open/close counter (FR-06) |
| POST | `/api/counters/:id/next` | Yes | Operator | Call next customer (FR-04) |
| POST | `/api/counters/:id/serve` | Yes | Operator | Mark served (FR-05) |

---

## C.5 Role / Permission Matrix

| Operation | Customer | Operator | Unauthenticated |
|-----------|:--------:|:--------:|:---------------:|
| Login / Logout | ✅ | ✅ | ✅ (login only) |
| Join Queue | ✅ | ❌ 403 | ❌ 401 |
| View own ticket | ✅ | ❌ 403 | ❌ 401 |
| Cancel own ticket | ✅ | ❌ 403 | ❌ 401 |
| View public board | ✅ | ✅ | ✅ |
| Open/Close counter | ❌ 403 | ✅ (own only) | ❌ 401 |
| Call next customer | ❌ 403 | ✅ (own only) | ❌ 401 |
| Mark served | ❌ 403 | ✅ (own only) | ❌ 401 |

**Ownership rule (BR-04):** Operator endpoints verify `counter.operatorId === req.user.id`; mismatch → HTTP 403 `FORBIDDEN`

---

## C.6 Authentication Design

| Concern | Design |
|---------|--------|
| Password storage | `bcryptjs` hash with cost factor 12 |
| Session type | Stateless JWT, signed with `JWT_SECRET` env variable |
| Token storage | HTTP-only cookie (`token`); not accessible from JavaScript |
| Token expiry | 24 hours |
| Current user retrieval | `requireAuth` middleware decodes JWT from cookie on each request |
| Logout | Server calls `res.clearCookie("token")`; client redirected to login |
| CORS | Allows only `http://localhost:5173` with `credentials: true` |

---

## C.7 Configuration & Deployment Design

**Environment Variables (`server/.env`):**
```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/queueservice"
JWT_SECRET="your-strong-secret-here"
PORT=3001
```

- Secrets: never committed to Git (`.env` in `.gitignore`; only `.env.example` committed)
- DB config: via `DATABASE_URL` only (Prisma reads from env)
- Application is designed to be **stateless** (suitable for Docker + GCP Cloud Run)
- Planned GCP deployment: Cloud Run (API + UI) + Cloud SQL (PostgreSQL)
- Actual cloud setup deferred to Lab 5

