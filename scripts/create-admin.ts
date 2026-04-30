/**
 * Create or reset a SUPER_ADMIN account (e.g. new VPS / lost database).
 *
 * Run on the server with your real .env loaded:
 *   npx tsx scripts/create-admin.ts
 *
 * Required env:
 *   BOOTSTRAP_ADMIN_EMAIL
 *   BOOTSTRAP_ADMIN_PASSWORD   (min 10 characters)
 * Optional:
 *   BOOTSTRAP_ADMIN_NAME
 */
import { hash } from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Administrator";

  if (!email || !password) {
    console.error(
      "Missing BOOTSTRAP_ADMIN_EMAIL or BOOTSTRAP_ADMIN_PASSWORD.\nExample:\n  BOOTSTRAP_ADMIN_EMAIL=you@yourdomain.com BOOTSTRAP_ADMIN_PASSWORD='your-long-secret' npx tsx scripts/create-admin.ts",
    );
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("BOOTSTRAP_ADMIN_PASSWORD must be at least 10 characters.");
    process.exit(1);
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
    },
    update: {
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      accountBlocked: false,
      ...(name ? { name } : {}),
    },
  });

  console.log("OK — admin user ready.");
  console.log("  Email:", user.email);
  console.log("  Role: ", user.role);
  console.log("Sign in at /login with email + password.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
