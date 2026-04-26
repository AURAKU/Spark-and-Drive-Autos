import { NextResponse } from "next/server";

import { getRequestIp } from "@/lib/client-ip";
import { ACCEPTANCE_CONTEXT, recordUserPolicyAcceptance } from "@/lib/legal-acceptance";
import { writeLegalAuditLog } from "@/lib/legal-audit";
import { getMissingRequiredPolicies } from "@/lib/legal-reacceptance";
import { safeAuth } from "@/lib/safe-auth";

export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }

  const userId = session.user.id;
  const ipAddress = getRequestIp(req);
  const userAgent = req.headers.get("user-agent");

  const missing = await getMissingRequiredPolicies(userId);
  if (missing.length === 0) {
    return NextResponse.json({ ok: true, accepted: 0 });
  }

  for (const policy of missing) {
    await recordUserPolicyAcceptance({
      userId,
      policyVersionId: policy.id,
      context: ACCEPTANCE_CONTEXT.LOGIN_REACCEPTANCE,
      ipAddress,
      userAgent,
    });

    await writeLegalAuditLog({
      actorId: userId,
      targetUserId: userId,
      action: "POLICY_ACCEPTED",
      entityType: "PolicyVersion",
      entityId: policy.id,
      metadata: {
        context: "LOGIN_REACCEPTANCE",
        policyKey: policy.policyKey,
        version: policy.version,
      },
      ipAddress,
      userAgent,
    });
  }

  return NextResponse.json({ ok: true, accepted: missing.length });
}
