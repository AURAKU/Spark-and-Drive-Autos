import { hash } from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

function readRequired(name: "SEED_SUPER_ADMIN_EMAIL" | "SEED_SUPER_ADMIN_PASSWORD" | "SEED_SUPER_ADMIN_NAME") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

async function main() {
  const email = readRequired("SEED_SUPER_ADMIN_EMAIL").toLowerCase();
  const password = readRequired("SEED_SUPER_ADMIN_PASSWORD");
  const name = readRequired("SEED_SUPER_ADMIN_NAME");

  if (password.length < 10) {
    throw new Error("SEED_SUPER_ADMIN_PASSWORD must be at least 10 characters.");
  }

  const passwordHash = await hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      accountBlocked: false,
      emailVerified: new Date(),
    },
    update: {
      name,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      accountBlocked: false,
      emailVerified: new Date(),
    },
    select: { id: true, email: true, role: true },
  });

  console.log("[seed:admin] Super admin is ready.");
  console.log(`[seed:admin] user=${user.email} role=${user.role} id=${user.id}`);
}

main()
  .catch((error) => {
    console.error("[seed:admin] failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
