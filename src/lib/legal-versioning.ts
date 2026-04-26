import { prisma } from "@/lib/prisma";
import { writeLegalAuditLog } from "@/lib/legal-audit";
import { POLICY_KEYS } from "@/lib/legal-enforcement";

export type LegalContext =
  | "CHECKOUT"
  | "LOGIN"
  | "SOURCING"
  | "PAYMENT"
  | "VERIFICATION";

export class PolicyAcceptanceRequiredError extends Error {
  policyKey: string;
  version: string;
  title: string | null;
  effectiveDate: string;
  context: LegalContext;

  constructor(input: {
    policyKey: string;
    version: string;
    title: string | null;
    effectiveDate: string;
    context: LegalContext;
  }) {
    super("REQUIRE_ACCEPTANCE");
    this.name = "PolicyAcceptanceRequiredError";
    this.policyKey = input.policyKey;
    this.version = input.version;
    this.title = input.title;
    this.effectiveDate = input.effectiveDate;
    this.context = input.context;
  }
}

function resolveFallbackPolicyKeys(policyKey: string): string[] {
  if (policyKey === POLICY_KEYS.PLATFORM_TERMS) {
    return [POLICY_KEYS.PLATFORM_TERMS, POLICY_KEYS.PLATFORM_TERMS_PRIVACY];
  }
  if (policyKey === POLICY_KEYS.PRIVACY_POLICY) {
    return [POLICY_KEYS.PRIVACY_POLICY, POLICY_KEYS.PLATFORM_TERMS_PRIVACY];
  }
  if (policyKey === POLICY_KEYS.REFUND_POLICY) {
    return [POLICY_KEYS.REFUND_POLICY, POLICY_KEYS.REFUND_AND_CANCELLATION_POLICY];
  }
  if (policyKey === POLICY_KEYS.VEHICLE_SOURCING_CONTRACT) {
    return [POLICY_KEYS.VEHICLE_SOURCING_CONTRACT, POLICY_KEYS.SOURCING_CONTRACT];
  }
  return [policyKey];
}

export async function getActivePolicy(policyKey: string) {
  const keys = resolveFallbackPolicyKeys(policyKey);
  const active = await prisma.policyVersion.findFirst({
    where: { policyKey: { in: keys }, isActive: true },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      policyKey: true,
      version: true,
      title: true,
      content: true,
      effectiveAt: true,
    },
  });
  return active;
}

export async function hasUserAccepted(userId: string, policyKey: string, version: string): Promise<boolean> {
  const keys = resolveFallbackPolicyKeys(policyKey);
  const row = await prisma.userPolicyAcceptance.findFirst({
    where: {
      userId,
      policyVersion: {
        policyKey: { in: keys },
        version,
        isActive: true,
      },
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function requirePolicyAcceptance(input: {
  userId: string;
  policyKey: string;
  context: LegalContext;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const active = await getActivePolicy(input.policyKey);
  if (!active) {
    return null;
  }
  const accepted = await hasUserAccepted(input.userId, input.policyKey, active.version);
  if (accepted) return active;

  await writeLegalAuditLog({
    actorId: input.userId,
    targetUserId: input.userId,
    action: "REQUIRED",
    entityType: "PolicyVersion",
    entityId: active.id,
    metadata: {
      policyKey: input.policyKey,
      activePolicyKey: active.policyKey,
      version: active.version,
      context: input.context,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
  await writeLegalAuditLog({
    actorId: input.userId,
    targetUserId: input.userId,
    action: "BLOCKED",
    entityType: "PolicyVersion",
    entityId: active.id,
    metadata: {
      policyKey: input.policyKey,
      activePolicyKey: active.policyKey,
      version: active.version,
      context: input.context,
      reason: "MISSING_ACCEPTANCE",
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
  throw new PolicyAcceptanceRequiredError({
    policyKey: active.policyKey,
    version: active.version,
    title: active.title,
    effectiveDate: active.effectiveAt.toISOString(),
    context: input.context,
  });
}
