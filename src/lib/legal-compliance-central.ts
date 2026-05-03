import { NextResponse } from "next/server";

import { ACCEPTANCE_CONTEXT, recordUserContractAcceptance, recordUserPolicyAcceptance } from "@/lib/legal-acceptance";
import { getActiveLegalCatalogFingerprint, getUserLegalStatusRows } from "@/lib/legal-profile";
import { prisma } from "@/lib/prisma";

export const PROFILE_LEGAL_URL = "/dashboard/profile?view=legal";

export async function isProfileLegalComplete(userId: string): Promise<boolean> {
  const rows = await getUserLegalStatusRows(userId);
  if (rows.length === 0) return true;
  return rows.every((r) => r.accepted);
}

export async function acceptAllPendingLegalDocuments(
  userId: string,
  ipAddress: string | null,
  userAgent: string | null,
) {
  const rows = await getUserLegalStatusRows(userId);
  const pending = rows.filter((row) => !row.accepted);
  if (pending.length === 0) {
    return { acceptedPolicies: 0, acceptedContracts: 0, remaining: 0 };
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

  await syncUserLegalAcceptanceMetadata(userId, ipAddress, userAgent);

  return { acceptedPolicies, acceptedContracts, remaining: 0 };
}

export async function syncUserLegalAcceptanceMetadata(
  userId: string,
  ipAddress: string | null,
  userAgent: string | null,
) {
  const complete = await isProfileLegalComplete(userId);
  if (!complete) return;

  const fingerprint = await getActiveLegalCatalogFingerprint();
  await prisma.user.update({
    where: { id: userId },
    data: {
      legalAcceptedAt: new Date(),
      legalAcceptedVersion: fingerprint,
      legalAcceptedIp: ipAddress?.slice(0, 64) ?? null,
      legalAcceptedUserAgent: userAgent ? userAgent.slice(0, 512) : null,
    },
  });
}

export async function assertProfileLegalCompleteOrResponse(userId: string): Promise<NextResponse | null> {
  const rows = await getUserLegalStatusRows(userId);
  const pending = rows.filter((r) => !r.accepted);
  if (pending.length === 0) return null;

  return NextResponse.json(
    {
      error: "Please accept legal requirements on your Profile page before checkout.",
      code: "PROFILE_LEGAL_REQUIRED",
      profileUrl: PROFILE_LEGAL_URL,
      pendingCount: pending.length,
    },
    { status: 409 },
  );
}
