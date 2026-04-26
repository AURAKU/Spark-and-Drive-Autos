import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

import { requireAdmin } from "@/lib/auth-helpers";
import { POLICY_KEYS } from "@/lib/legal-enforcement";
import { prisma } from "@/lib/prisma";

function has(...values: Array<string | undefined>) {
  return values.every((value) => Boolean(value?.trim()));
}

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let database = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }

  const redisEnvReady = has(process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN);
  let redisConnection = false;
  if (redisEnvReady && /^https:\/\//i.test(process.env.UPSTASH_REDIS_REST_URL ?? "")) {
    try {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
      await redis.ping();
      redisConnection = true;
    } catch {
      redisConnection = false;
    }
  }

  const [activePolicy, activeReceiptTemplates, superAdminExists, lastBackup] = await Promise.all([
    prisma.policyVersion.findFirst({
      where: {
        isActive: true,
        policyKey: { in: [POLICY_KEYS.PLATFORM_TERMS_PRIVACY, POLICY_KEYS.PLATFORM_TERMS, POLICY_KEYS.PRIVACY_POLICY] },
      },
      select: { id: true },
    }),
    prisma.receiptTemplate.count({ where: { isActive: true } }),
    prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, select: { id: true } }),
    prisma.systemBackupLog.findFirst({
      where: { status: "SUCCESS" },
      orderBy: { completedAt: "desc" },
      select: { createdAt: true, completedAt: true, fileName: true, type: true },
    }),
  ]);

  const storageProviderPresent = has(
    process.env.CLOUDINARY_CLOUD_NAME,
    process.env.CLOUDINARY_API_KEY,
    process.env.CLOUDINARY_API_SECRET,
  );

  const checks = {
    databaseConnection: database,
    redisConnection,
    cloudinaryReady: storageProviderPresent,
    storageProviderPresent,
    paystackReady: has(
      process.env.PAYSTACK_SECRET_KEY,
      process.env.PAYSTACK_PUBLIC_KEY,
      process.env.PAYSTACK_WEBHOOK_SECRET,
    ),
    resendReady: has(process.env.RESEND_API_KEY, process.env.RESET_PASSWORD_FROM_EMAIL),
    serperReady: has(process.env.SERPER_API_KEY),
    pusherReady: has(
      process.env.PUSHER_APP_ID,
      process.env.PUSHER_KEY,
      process.env.PUSHER_SECRET,
      process.env.PUSHER_CLUSTER,
    ),
    activeLegalPolicyExists: Boolean(activePolicy),
    activeReceiptTemplatesExist: activeReceiptTemplates > 0,
    superAdminExists: Boolean(superAdminExists),
    backupMetadataExists: Boolean(lastBackup),
    lastBackupCompletedAt: lastBackup?.completedAt?.toISOString() ?? null,
    lastBackupCreatedAt: lastBackup?.createdAt?.toISOString() ?? null,
    lastBackupFileName: lastBackup?.fileName ?? null,
    lastBackupType: lastBackup?.type ?? null,
  };

  return NextResponse.json({
    ok: Object.values(checks).every(Boolean),
    checks,
  });
}
