import { NextResponse } from "next/server";

import { getRequestIp } from "@/lib/client-ip";
import { acceptAllPendingLegalDocuments } from "@/lib/legal-compliance-central";
import { writeLegalAuditLog } from "@/lib/legal-audit";
import { safeAuth } from "@/lib/safe-auth";

/** @deprecated Prefer Profile → legal or POST /api/profile/legal-acceptance — kept for older clients. */
export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }

  const userId = session.user.id;
  const ipAddress = getRequestIp(req);
  const userAgent = req.headers.get("user-agent");

  const { acceptedPolicies, acceptedContracts } = await acceptAllPendingLegalDocuments(userId, ipAddress, userAgent);
  const accepted = acceptedPolicies + acceptedContracts;

  if (accepted > 0) {
    await writeLegalAuditLog({
      actorId: userId,
      targetUserId: userId,
      action: "USER_ACCEPTED_LEGAL_BULK",
      entityType: "User",
      entityId: userId,
      metadata: { acceptedPolicies, acceptedContracts, source: "api.legal.reaccept-required" },
      ipAddress,
      userAgent,
    });
  }

  return NextResponse.json({ ok: true, accepted });
}
