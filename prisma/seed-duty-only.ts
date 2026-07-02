/**
 * Idempotent Ghana duty configuration seed — safe for production deploy scripts.
 * Usage: npm run seed:duty
 */
import { PrismaClient } from "@prisma/client";

import { seedDutyIntelligence } from "./seed-duty-intelligence";

const prisma = new PrismaClient();

async function main() {
  const country = await seedDutyIntelligence(prisma);
  console.log(`[seed:duty] Ghana duty configuration ready (${country.id})`);
}

main()
  .catch((e) => {
    console.error("[seed:duty] failed", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
