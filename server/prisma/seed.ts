import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const HASH_ROUNDS = 12;

  // ── Seed users ──────────────────────────────────────────
  // Uses upsert so the script is safe to run multiple times.

  const customer1 = await prisma.user.upsert({
    where: { email: "customer1@test.com" },
    update: {},
    create: {
      email: "customer1@test.com",
      passwordHash: await bcrypt.hash("password123", HASH_ROUNDS),
      role: "CUSTOMER",
    },
  });

  const customer2 = await prisma.user.upsert({
    where: { email: "customer2@test.com" },
    update: {},
    create: {
      email: "customer2@test.com",
      passwordHash: await bcrypt.hash("password123", HASH_ROUNDS),
      role: "CUSTOMER",
    },
  });

  const operator1 = await prisma.user.upsert({
    where: { email: "operator1@test.com" },
    update: {},
    create: {
      email: "operator1@test.com",
      passwordHash: await bcrypt.hash("password123", HASH_ROUNDS),
      role: "OPERATOR",
    },
  });

  const operator2 = await prisma.user.upsert({
    where: { email: "operator2@test.com" },
    update: {},
    create: {
      email: "operator2@test.com",
      passwordHash: await bcrypt.hash("password123", HASH_ROUNDS),
      role: "OPERATOR",
    },
  });

  // ── Seed counters ────────────────────────────────────────
  // Each counter is assigned to one operator.

  await prisma.counter.upsert({
    where: { operatorId: operator1.id },
    update: {},
    create: {
      name: "Counter A",
      status: "CLOSED",
      currentServing: 0,
      operatorId: operator1.id,
    },
  });

  await prisma.counter.upsert({
    where: { operatorId: operator2.id },
    update: {},
    create: {
      name: "Counter B",
      status: "CLOSED",
      currentServing: 0,
      operatorId: operator2.id,
    },
  });

  console.log("✅ Seeded accounts:");
  console.log(`   Customer : customer1@test.com / password123`);
  console.log(`   Customer : customer2@test.com / password123`);
  console.log(`   Operator : operator1@test.com / password123  → Counter A`);
  console.log(`   Operator : operator2@test.com / password123  → Counter B`);
  console.log("✅ Seeded 2 counters (Counter A, Counter B)");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

