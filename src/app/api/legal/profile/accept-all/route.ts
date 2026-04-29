import { NextResponse } from "next/server";

import { getRequestIp } from "@/lib/client-ip";
import { ACCEPTANCE_CONTEXT, recordUserContractAcceptance, recordUserPolicyAcceptance } from "@/lib/legal-acceptance";
import { writeLegalAuditLog } from "@/lib/legal-audit";
import { getUserLegalStatusRows } from "@/lib/legal-profile";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }

  const userId = session.user.id;
  const ipAddress = getRequestIp(req);
  const userAgent = req.headers.get("user-agent");
  const rows = await getUserLegalStatusRows(userId);
  const pending = rows.filter((row) => !row.accepted);
  if (pending.length === 0) {
    return NextResponse.json({ ok: true, acceptedPolicies: 0, acceptedContracts: 0, remaining: 0 });
  }

  let acceptedPolicies = 0;
  let acceptedContracts = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of pending) {
      if (row.kind === "policy") {
        await recordUserPolicyAcceptance({
          userId,
          policyVersionId: row.id,
          context: ACCEPTANCE_CONTEXT.PROFILE_BULK,
          ipAddress,
          userAgent,
          tx,
        });
        acceptedPolicies += 1;
      } else {
        await recordUserContractAcceptance({
          userId,
          contractId: row.id,
          contractVersion: row.version,
          context: ACCEPTANCE_CONTEXT.PROFILE_BULK,
          ipAddress,
          userAgent,
          tx,
        });
        acceptedContracts += 1;
      }
    }
  });

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

  return NextResponse.json({
    ok: true,
    acceptedPolicies,
    acceptedContracts,
    remaining: 0,
  });
}
