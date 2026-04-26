import { prisma } from "@/lib/prisma";

import { getActiveSourcingContractRow } from "@/lib/legal-enforcement";

export async function hasAcceptedActivePolicy(userId: string, policyKey: string): Promise<boolean> {
  const active = await prisma.policyVersion.findFirst({
    where: { policyKey, isActive: true },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  if (!active) return false;
  const hit = await prisma.userPolicyAcceptance.findFirst({
    where: { userId, policyVersionId: active.id },
    select: { id: true },
  });
  return Boolean(hit);
}

export async function hasAcceptedActiveSourcingContract(userId: string): Promise<boolean> {
  const active = await getActiveSourcingContractRow();
  if (!active) return false;
  const hit = await prisma.contractAcceptance.findFirst({
    where: {
      userId,
      contractId: active.id,
    },
    select: { id: true },
  });
  return Boolean(hit);
}

export async function createUserLegalAcceptanceGuard(userId: string) {
  return {
    hasAccepted: async (policyKey: string) => hasAcceptedActivePolicy(userId, policyKey),
    hasAcceptedSourcingContract: async () => hasAcceptedActiveSourcingContract(userId),
  };
}

export async function getUserPolicyAcceptanceSnapshot(userId: string, policyKeys: string[]) {
  const activePolicies = await prisma.policyVersion.findMany({
    where: { isActive: true, policyKey: { in: policyKeys } },
    orderBy: [{ policyKey: "asc" }, { effectiveAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, policyKey: true, version: true, createdAt: true },
  });

  const latestByKey = new Map<string, { id: string; policyKey: string; version: string; createdAt: Date }>();
  for (const p of activePolicies) {
    if (!latestByKey.has(p.policyKey)) latestByKey.set(p.policyKey, p);
  }

  const accepts = await prisma.userPolicyAcceptance.findMany({
    where: { userId, policyVersionId: { in: [...latestByKey.values()].map((x) => x.id) } },
    orderBy: { acceptedAt: "desc" },
    select: { policyVersionId: true, acceptedAt: true },
  });
  const acceptedAtByVersionId = new Map<string, Date>();
  for (const a of accepts) {
    if (!acceptedAtByVersionId.has(a.policyVersionId)) acceptedAtByVersionId.set(a.policyVersionId, a.acceptedAt);
  }

  return [...latestByKey.values()].map((p) => ({
    policyKey: p.policyKey,
    version: p.version,
    accepted: acceptedAtByVersionId.has(p.id),
    acceptedAt: acceptedAtByVersionId.get(p.id) ?? null,
    lastUpdatedAt: p.createdAt,
  }));
}
