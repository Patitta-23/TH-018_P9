# Queue and Service Management System

> **CPE 334 Introduction to Software Engineering** — Project Deliverable 1 (Sprint 1)  
> Department of Computer Engineering, King Mongkut's University of Technology Thonburi (KMUTT)

---

## 📋 Project Overview

The **Queue and Service Management System** is a responsive web application designed to streamline customer service queues and counter operations. 

In **Sprint 1**, the system supports two core actor roles:
- **Customer:** Request a queue ticket, monitor active queue position, and cancel the ticket.
- **Operator:** Manage service counters (Open/Close), call the next customer in waiting order, and mark tickets as served.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Bootstrap 5 |
| **Backend** | Node.js, Express, TypeScript |
| **Database & ORM** | PostgreSQL 15+, Prisma ORM |
| **Authentication** | JWT stored in secure `HTTP-only` cookie + bcryptjs |
| **Testing** | Vitest + Testing Library (Client UI) / Vitest + Supertest (Backend API) |

---

## 👥 Seed Accounts & Roles

| Email | Password | Role | Assigned Resource |
|---|---|---|---|
| `customer1@test.com` | `password123` | **Customer** | — |
| `customer2@test.com` | `password123` | **Customer** | — |
| `operator1@test.com` | `password123` | **Operator** | Counter A |
| `operator2@test.com` | `password123` | **Operator** | Counter B |

---

## ⚙️ Prerequisites

- **Node.js** >= 18.x (Tested with Node v24)
- **npm** >= 9.x
- **Docker** (or local PostgreSQL instance)

---

## 🚀 Getting Started

### 1. Database Setup (via Docker)

If you have Docker installed and running:

```bash
# Option A: If using the existing postgres container
docker exec postgres psql -U toktickit -c "CREATE DATABASE queueservice;"

# Option B: Run a fresh PostgreSQL container
docker run --name queueservice-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=queueservice -p 5432:5432 -d postgres:15
```

### 2. Environment Configuration

Create `server/.env` with your database credentials:

```bash
cp server/.env.example server/.env
```

Ensure `server/.env` contains:

```env
DATABASE_URL="postgresql://toktickit:toktickit@localhost:5432/queueservice"
JWT_SECRET="queue-service-jwt-secret-2026"
PORT=3001
```
*(Adjust the database username and password if using a custom PostgreSQL setup)*

### 3. Install Dependencies

```bash
# Install Server dependencies
cd server
npm install

# Install Client dependencies
cd ../client
npm install
```

### 4. Database Migration & Seeding

```bash
cd server
npx prisma migrate dev --name init
npx prisma db seed
```

### 5. Running the Application

Open two terminal windows:

**Terminal 1 — Backend API Server:**
```bash
cd server
npm run dev
# Running at http://localhost:3001
```

**Terminal 2 — Frontend Client:**
```bash
cd client
npm run dev
# Running at http://localhost:5174 (or http://localhost:5173)
```

Visit **http://localhost:5174** in your browser.

---

## 🧪 Running Automated Tests

### Backend API Tests (20 tests)
Verifies authentication, role-based access control, queue lifecycle, and business rules (BR-01 to BR-04):
```bash
cd server
npm test
```

### Frontend UI Tests (7 tests)
Verifies login form rendering, customer dashboard actions, and operator counter controls:
```bash
cd client
npm test
```

---

## 📡 REST API Summary

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `POST` | `/api/auth/login` | No | Any | User login, sets HTTP-only JWT cookie |
| `POST` | `/api/auth/logout` | Yes | Any | Clears auth session cookie |
| `GET` | `/api/auth/me` | Yes | Any | Returns current authenticated user |
| `GET` | `/api/board` | No | Public | Returns public queue board & counter statuses |
| `POST` | `/api/queues/join` | Yes | Customer | Request a queue ticket (**BR-01** enforced) |
| `GET` | `/api/queues/my-ticket` | Yes | Customer | View active ticket & queue position (**BR-02**) |
| `DELETE` | `/api/queues/my-ticket` | Yes | Customer | Cancel active ticket |
| `PATCH` | `/api/counters/:id/status` | Yes | Operator | Open or close counter |
| `POST` | `/api/counters/:id/next` | Yes | Operator | Call next ticket (**BR-03**, FIFO order) |
| `POST` | `/api/counters/:id/serve` | Yes | Operator | Complete service (**BR-04**) |

---

## 📁 Repository Structure & Deliverable Documentation

```text
queue-service/
├── client/                      # React Frontend application
│   ├── src/
│   │   ├── App.tsx              # Main UI component (Login, Customer, Operator)
│   │   ├── App.test.tsx         # Vitest UI test suite
│   │   ├── main.tsx
│   │   └── setupTests.ts
│   ├── package.json
│   └── vite.config.ts
├── server/                      # Express Backend application
│   ├── prisma/
│   │   ├── schema.prisma        # Prisma Schema (User, Counter, QueueTicket)
│   │   └── seed.ts              # Seed database with users and counters
│   ├── src/
│   │   ├── app.ts               # Express endpoints and business logic
│   │   ├── index.ts             # Server entry point (port 3001)
│   │   └── middleware/
│   │       └── auth.ts          # JWT authentication and RBAC guards
│   ├── tests/sprint-1/          # Automated API test suites
│   │   ├── auth.test.ts         # TEST-01 to TEST-05 (Auth & RBAC)
│   │   ├── queues.test.ts       # TEST-06 to TEST-13 (Customer Queue Actions)
│   │   └── counters.test.ts     # TEST-14 to TEST-18 (Operator Actions)
│   ├── .env.example
│   └── package.json
├── docs/                        # Deliverable 1 Documentation
│   ├── srs.md                   # Part A: Software Requirements Specification
│   ├── features.md              # Part B: Feature List (F-01 - F-07)
│   ├── traceability.md          # Part B: Requirements Traceability Matrix
│   ├── system-sds.md            # Part C: Software Design Specification
│   ├── sprints/
│   │   ├── plan.md              # Part D: 3-Sprint Project Plan
│   │   └── sprint-1/            # Part E: Sprint 1 Contracts & DoD
│   │       ├── F-01-join-queue.md
│   │       ├── F-02-F-03-queue-status.md
│   │       ├── F-04-auth.md
│   │       ├── F-05-F-06-operator.md
│   │       └── dod.md
│   └── sprint-1/                # Part F: Sprint Delivery Evidence
│       ├── tests.md             # Test cases & execution logs
│       ├── reviewer.md          # PR & Peer Code Review logs
│       └── ai_use.md            # GenAI Usage Reflection
├── .gitignore
└── README.md
```
