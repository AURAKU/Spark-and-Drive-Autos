import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestIp } from "@/lib/client-ip";
import { ACCEPTANCE_CONTEXT, recordUserPolicyAcceptance } from "@/lib/legal-acceptance";
import { POLICY_KEYS } from "@/lib/legal-enforcement";
import { writeLegalAuditLog } from "@/lib/legal-audit";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

const schema = z.object({
  policyKey: z.string().min(2).max(80),
  context: z
    .enum([
      ACCEPTANCE_CONTEXT.CHECKOUT,
      ACCEPTANCE_CONTEXT.PAYMENT,
      ACCEPTANCE_CONTEXT.VERIFICATION,
      ACCEPTANCE_CONTEXT.LOGIN,
      ACCEPTANCE_CONTEXT.SOURCING,
      ACCEPTANCE_CONTEXT.PARTS_FINDER_ACTIVATION,
      ACCEPTANCE_CONTEXT.PARTS_FINDER_SEARCH,
      ACCEPTANCE_CONTEXT.SOURCING_REQUEST,
      ACCEPTANCE_CONTEXT.REGISTRATION,
      ACCEPTANCE_CONTEXT.ADMIN,
    ])
    .optional(),
});

export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  const ip = getRequestIp(req);
  const userAgent = req.headers.get("user-agent");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Validation failed." }, { status: 400 });
  }

  const keys =
    parsed.data.policyKey === POLICY_KEYS.PARTS_FINDER_DISCLAIMER
      ? [POLICY_KEYS.PARTS_FINDER_DISCLAIMER, POLICY_KEYS.PLATFORM_TERMS_PRIVACY]
      : [parsed.data.policyKey];
  let active: { id: string; version: string; policyKey: string } | null = null;
  for (const key of keys) {
    active = await prisma.policyVersion.findFirst({
      where: { policyKey: key, isActive: true },
      orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, version: true, policyKey: true },
    });
    if (active) break;
  }
  if (!active) {
    if (parsed.data.policyKey === POLICY_KEYS.PARTS_FINDER_DISCLAIMER) {
      console.warn("[legal] No active required legal policy found; skipping re-acceptance gate.");
    }
    return NextResponse.json({ ok: false, error: "No active policy for this key." }, { status: 404 });
  }

  const context = parsed.data.context ?? ACCEPTANCE_CONTEXT.ADMIN;
  await recordUserPolicyAcceptance({
    userId: session.user.id,
    policyVersionId: active.id,
    context,
    ipAddress: ip,
    userAgent,
  });
  await writeLegalAuditLog({
    actorId: session.user.id,
    targetUserId: session.user.id,
    action: "ACCEPTED",
    entityType: "PolicyVersion",
    entityId: active.id,
    metadata: { policyKey: active.policyKey, version: active.version, context },
    ipAddress: ip,
    userAgent,
  });

  return NextResponse.json({
    ok: true,
    policyKey: active.policyKey,
    version: active.version,
    acceptedAt: new Date().toISOString(),
  });
}
