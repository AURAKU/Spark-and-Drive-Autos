import { prisma } from "@/lib/prisma";

const BLOCKING_TAGS = ["FRAUD_RISK_REVIEW", "MANUAL_REVIEW_REQUIRED"] as const;

export async function getUserRiskTags(userId: string): Promise<string[]> {
  const rows = await prisma.userRiskTag.findMany({
    where: { userId, isActive: true },
    select: { tag: true },
  });
  return rows.map((r) => r.tag);
}

export async function userNeedsManualApproval(userId: string): Promise<boolean> {
  const risk = await getUserRiskTags(userId);
  return BLOCKING_TAGS.some((tag) => risk.includes(tag));
}
