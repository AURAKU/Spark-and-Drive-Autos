import { NextResponse } from "next/server";

import { getRequestIp } from "@/lib/client-ip";
import { acceptAllPendingLegalDocuments } from "@/lib/legal-compliance-central";
import { writeLegalAuditLog } from "@/lib/legal-audit";
import { safeAuth } from "@/lib/safe-auth";

export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }

  const userId = session.user.id;
  const ipAddress = getRequestIp(req);
  const userAgent = req.headers.get("user-agent");

  const { acceptedPolicies, acceptedContracts, remaining } = await acceptAllPendingLegalDocuments(
    userId,
    ipAddress,
    userAgent,
  );

  if (acceptedPolicies + acceptedContracts > 0) {
    await writeLegalAuditLog({
      actorId: userId,
      targetUserId: userId,
      action: "USER_ACCEPTED_LEGAL_BULK",
      entityType: "User",
      entityId: userId,
      metadata: { acceptedPolicies, acceptedContracts, source: "dashboard.profile.legal.bulk" },
      ipAddress,
      userAgent,
    });
  }

  return NextResponse.json({
    ok: true,
    acceptedPolicies,
    acceptedContracts,
    remaining,
  });
}
