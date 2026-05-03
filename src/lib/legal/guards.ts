import { POLICY_KEYS, SOURCING_CONTRACT_TYPES } from "@/lib/legal-enforcement";
import { prisma as db } from "@/lib/prisma";

function policyKeysEquivalentTo(requestedKey: string): string[] {
  if (requestedKey === POLICY_KEYS.PLATFORM_TERMS) {
    return [POLICY_KEYS.PLATFORM_TERMS, POLICY_KEYS.PLATFORM_TERMS_PRIVACY];
  }
  if (requestedKey === POLICY_KEYS.PRIVACY_POLICY) {
    return [POLICY_KEYS.PRIVACY_POLICY, POLICY_KEYS.PLATFORM_TERMS_PRIVACY];
  }
  if (requestedKey === POLICY_KEYS.PLATFORM_TERMS_PRIVACY) {
    return [POLICY_KEYS.PLATFORM_TERMS_PRIVACY, POLICY_KEYS.PLATFORM_TERMS, POLICY_KEYS.PRIVACY_POLICY];
  }
  if (requestedKey === POLICY_KEYS.SOURCING_RISK_ACKNOWLEDGEMENT || requestedKey === POLICY_KEYS.RISK_ACKNOWLEDGEMENT) {
    return [POLICY_KEYS.SOURCING_RISK_ACKNOWLEDGEMENT, POLICY_KEYS.RISK_ACKNOWLEDGEMENT];
  }
  return [requestedKey];
}

/**
 * Throws when user has not accepted a policy key (acceptance on any equivalent active key counts).
 */
export async function requirePolicy(userId: string, policyKey: string) {
  const keys = policyKeysEquivalentTo(policyKey);
  const accepted = await db.userPolicyAcceptance.findFirst({
    where: {
      userId,
      policyVersion: { policyKey: { in: keys }, isActive: true },
    },
    select: { id: true },
  });

  if (!accepted) {
    throw new Error("POLICY_NOT_ACCEPTED");
  }
}

export async function requireContract(userId: string, contractKey: string) {
  const types =
    contractKey === "VEHICLE_PARTS_SOURCING_CONTRACT" ? [...SOURCING_CONTRACT_TYPES] : [contractKey];
  const accepted = await db.contractAcceptance.findFirst({
    where: {
      userId,
      contract: { type: { in: types }, isActive: true },
    },
    select: { id: true },
  });

  if (!accepted) {
    throw new Error("CONTRACT_NOT_ACCEPTED");
  }
}
