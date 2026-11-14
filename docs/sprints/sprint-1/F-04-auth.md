# Part E — Feature Engineering Contract: F-04 Authentication

> **Sprint 1** | Linked: NFR-02, NFR-03 | File: `docs/sprints/sprint-1/F-04-auth.md`
> Version history: v1.0 — initial contract (before implementation)

---

## Feature Description

Provides login and logout for both Customer and Operator roles.
On success, issues a JWT stored in an HTTP-only cookie.
All protected API routes require a valid token; role guards restrict access by role.

**Linked requirements:** NFR-02 (401 on unauthenticated), NFR-03 (403 on wrong role)

---

## UI Behavior

- `/` renders a login form with email + password fields
- On success: redirect to Customer or Operator dashboard based on role
- On failure: show inline `alert-danger` with error message
- Logout button appears in nav on all authenticated pages
- Clicking Logout: calls `POST /api/auth/logout` → clears cookie → shows login form

---

## API Specification

### POST /api/auth/login
```
Request:  { email: string, password: string }

Response 200:
  Set-Cookie: token=<jwt>; HttpOnly; Max-Age=86400
  { "user": { "id": number, "email": string, "role": "CUSTOMER" | "OPERATOR" } }

Response 400: { "error": "Email and password required", "code": "MISSING_FIELDS" }
Response 401: { "error": "Invalid credentials",          "code": "INVALID_CREDENTIALS" }
```

### POST /api/auth/logout
```
Response 200:
  Set-Cookie: token=; Max-Age=0   ← clears cookie
  { "message": "Logged out" }
```

### GET /api/auth/me
```
Response 200: { "id": number, "email": string, "role": string }
Response 401: { "error": "Unauthorized", "code": "UNAUTHORIZED" }
```

---

## Data

No schema change — uses existing `User` table (`email`, `passwordHash`, `role`).
Password comparison uses `bcrypt.compare()` (cost factor 12 at seed time).

---

## Acceptance Criteria

| AC ID | Scenario | Expected Outcome |
|-------|----------|-----------------|
| **AC-01** | Valid Customer credentials | HTTP 200, JWT cookie set, `role: CUSTOMER` returned |
| **AC-01b** | Valid Operator credentials | HTTP 200, JWT cookie set, `role: OPERATOR` returned |
| **AC-02** | Wrong password | HTTP 401, no cookie set, no private data in body |
| **AC-03** | Logout after login | Cookie cleared; subsequent `GET /api/auth/me` returns 401 |
| **AC-04** | No cookie → protected endpoint | HTTP 401 `UNAUTHORIZED`, no private data (NFR-02) |
| **AC-05** | Customer role → Operator endpoint | HTTP 403 `FORBIDDEN` (NFR-03) |

---

## Software Test Specification (STS)

| Test ID | Linked AC | Level | Precondition / Input | Action | Expected Result |
|---------|-----------|-------|---------------------|--------|-----------------|
| TEST-01 | AC-01 | Integration (API) | Seeded `customer1@test.com` exists | POST `/api/auth/login` with correct credentials | 200; `Set-Cookie` present; `role: CUSTOMER` |
| TEST-01b | AC-01b | Integration (API) | Seeded `operator1@test.com` exists | POST `/api/auth/login` with operator credentials | 200; `role: OPERATOR` |
| TEST-02 | AC-02 | Integration (API) | Seeded account exists | POST `/api/auth/login` with wrong password | 401; no `Set-Cookie`; body has no `user` or `passwordHash` |
| TEST-03 | AC-03 | Integration (API) | Logged-in customer | POST `/api/auth/logout` → GET `/api/auth/me` | logout: 200 + cookie cleared; me: 401 |
| TEST-04 | AC-04 | Integration (API) | No cookie | GET `/api/queues/my-ticket` | 401 `UNAUTHORIZED` |
| TEST-05 | AC-05 | Integration (API) | Logged in as Customer | POST `/api/counters/1/next` | 403 `FORBIDDEN` |

**Test file:** `server/tests/sprint-1/auth.test.ts`

