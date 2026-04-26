import { prisma } from "@/lib/prisma";
import { POLICY_KEYS } from "@/lib/legal-enforcement";

export type RequiredPolicyForReacceptance = {
  id: string;
  policyKey: string;
  title: string | null;
  version: string;
  effectiveAt: Date;
  content: string | null;
};

async function getLatestActivePolicy(policyKey: string): Promise<RequiredPolicyForReacceptance | null> {
  return prisma.policyVersion.findFirst({
    where: { policyKey, isActive: true },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      policyKey: true,
      title: true,
      version: true,
      effectiveAt: true,
      content: true,
    },
  });
}

export async function getMissingRequiredPolicies(userId: string): Promise<RequiredPolicyForReacceptance[]> {
  const combined = await getLatestActivePolicy(POLICY_KEYS.PLATFORM_TERMS_PRIVACY);

  const requiredActive = combined
    ? [combined]
    : (
        await Promise.all([
          getLatestActivePolicy(POLICY_KEYS.PLATFORM_TERMS),
          getLatestActivePolicy(POLICY_KEYS.PRIVACY_POLICY),
        ])
      ).filter((row): row is RequiredPolicyForReacceptance => Boolean(row));

  if (requiredActive.length === 0) {
    console.warn("[legal] No active required legal policy found; skipping re-acceptance gate.");
    return [];
  }

  const acceptedIds = new Set(
    (
      await prisma.userPolicyAcceptance.findMany({
        where: {
          userId,
          policyVersionId: { in: requiredActive.map((row) => row.id) },
        },
        select: { policyVersionId: true },
      })
    ).map((row) => row.policyVersionId),
  );

  return requiredActive.filter((row) => !acceptedIds.has(row.id));
}
