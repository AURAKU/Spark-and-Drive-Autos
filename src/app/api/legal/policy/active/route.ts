import { NextResponse } from "next/server";

import { getRequestIp } from "@/lib/client-ip";
import { POLICY_KEYS } from "@/lib/legal-enforcement";
import { writeLegalAuditLog } from "@/lib/legal-audit";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

async function findActivePolicyWithFallback(policyKey: string) {
  const candidates =
    policyKey === POLICY_KEYS.PARTS_FINDER_DISCLAIMER
      ? [POLICY_KEYS.PARTS_FINDER_DISCLAIMER, POLICY_KEYS.PLATFORM_TERMS_PRIVACY]
      : [policyKey];
  for (const key of candidates) {
    const row = await prisma.policyVersion.findFirst({
      where: { policyKey: key, isActive: true },
      orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
      select: { policyKey: true, version: true, title: true, content: true, createdAt: true },
    });
    if (row) return row;
  }
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const policyKey = url.searchParams.get("policyKey")?.trim();
  if (!policyKey) {
    return NextResponse.json({ ok: false, error: "policyKey is required." }, { status: 400 });
  }
  const row = await findActivePolicyWithFallback(policyKey);
  if (!row) {
    return NextResponse.json({ ok: false, error: "No active policy." }, { status: 404 });
  }
  const session = await safeAuth();
  await writeLegalAuditLog({
    actorId: session?.user?.id ?? null,
    targetUserId: session?.user?.id ?? null,
    action: "VIEWED",
    entityType: "PolicyVersion",
    metadata: {
      policyKey: row.policyKey,
      version: row.version,
      context: "POLICY_VIEWER_MODAL",
    },
    ipAddress: getRequestIp(req),
    userAgent: req.headers.get("user-agent"),
  });
  return NextResponse.json({ ok: true, policy: row });
}
