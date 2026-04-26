import { prisma as db } from "@/lib/prisma";

/**
 * Throws when user has not accepted a policy key.
 * Matches current schema via UserPolicyAcceptance -> PolicyVersion.policyKey.
 */
export async function requirePolicy(userId: string, policyKey: string) {
  const accepted = await db.userPolicyAcceptance.findFirst({
    where: {
      userId,
      policyVersion: { policyKey, isActive: true },
    },
    select: { id: true },
  });

  if (!accepted) {
    throw new Error("POLICY_NOT_ACCEPTED");
  }
}

export async function requireContract(userId: string, contractKey: string) {
  const accepted = await db.contractAcceptance.findFirst({
    where: {
      userId,
      contract: { type: contractKey, isActive: true },
    },
    select: { id: true },
  });

  if (!accepted) {
    throw new Error("CONTRACT_NOT_ACCEPTED");
  }
}
