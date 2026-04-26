import { prisma } from "@/lib/prisma";

import { ACCEPTANCE_CONTEXT, recordUserContractAcceptance, recordUserPolicyAcceptance } from "@/lib/legal-acceptance";
import { writeLegalAuditLog } from "@/lib/legal-audit";
import { SOURCING_CONTRACT_TYPES } from "@/lib/legal-enforcement";

export async function getActivePolicy(policyKey: string) {
  return prisma.policyVersion.findFirst({
    where: { policyKey, isActive: true },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function getActiveContract(contractKey: string) {
  return prisma.contract.findFirst({
    where: { type: contractKey, isActive: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function hasAcceptedPolicy(userId: string, policyKey: string): Promise<boolean> {
  const active = await getActivePolicy(policyKey);
  if (!active) return false;
  const hit = await prisma.userPolicyAcceptance.findFirst({
    where: { userId, policyVersionId: active.id },
    select: { id: true },
  });
  return Boolean(hit);
}

export async function hasAcceptedContract(userId: string, contractKey: string): Promise<boolean> {
  const active = await getActiveContract(contractKey);
  if (!active) return false;
  const hit = await prisma.contractAcceptance.findFirst({
    where: { userId, contractId: active.id },
    select: { id: true },
  });
  return Boolean(hit);
}

export async function requirePolicyAcceptance(userId: string, policyKey: string) {
  if (!(await hasAcceptedPolicy(userId, policyKey))) {
    throw new Error(`POLICY_ACCEPTANCE_REQUIRED:${policyKey}`);
  }
}

export async function requireContractAcceptance(userId: string, contractKey: string) {
  if (!(await hasAcceptedContract(userId, contractKey))) {
    throw new Error(`CONTRACT_ACCEPTANCE_REQUIRED:${contractKey}`);
  }
}

export async function recordPolicyAcceptance(input: {
  userId: string;
  policyKey: string;
  context?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const active = await getActivePolicy(input.policyKey);
  if (!active) throw new Error("ACTIVE_POLICY_NOT_FOUND");
  await recordUserPolicyAcceptance({
    userId: input.userId,
    policyVersionId: active.id,
    context: (input.context as (typeof ACCEPTANCE_CONTEXT)[keyof typeof ACCEPTANCE_CONTEXT]) ?? ACCEPTANCE_CONTEXT.ADMIN,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
  return active;
}

export async function recordContractAcceptance(input: {
  userId: string;
  contractKey: string;
  context?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const active =
    (await getActiveContract(input.contractKey)) ??
    (input.contractKey === "VEHICLE_PARTS_SOURCING_CONTRACT"
      ? await prisma.contract.findFirst({
          where: { type: { in: [...SOURCING_CONTRACT_TYPES] }, isActive: true },
          orderBy: { createdAt: "desc" },
        })
      : null);
  if (!active) throw new Error("ACTIVE_CONTRACT_NOT_FOUND");
  await recordUserContractAcceptance({
    userId: input.userId,
    contractId: active.id,
    contractVersion: active.version,
    context: input.context ?? "ADMIN",
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
  return active;
}

export async function createLegalAuditLog(input: {
  actorId?: string | null;
  targetUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  await writeLegalAuditLog({
    actorId: input.actorId,
    targetUserId: input.targetUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: (input.metadata ?? null) as never,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
}

export async function getUserActiveRiskTags(userId: string) {
  return prisma.userRiskTag.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function requireNoBlockingRiskTags(userId: string) {
  const tags = await getUserActiveRiskTags(userId);
  const blocking = tags.find((t) => t.tag === "FRAUD_RISK_REVIEW" || t.tag === "MANUAL_REVIEW_REQUIRED");
  if (blocking) {
    throw new Error(`BLOCKING_RISK_TAG:${blocking.tag}`);
  }
}
