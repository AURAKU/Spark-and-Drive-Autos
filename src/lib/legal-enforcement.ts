import { SourceType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const POLICY_KEYS = {
  CHECKOUT_AGREEMENT: "CHECKOUT_AGREEMENT",
  SOURCING_CONTRACT: "SOURCING_CONTRACT",
  RISK_ACKNOWLEDGEMENT: "RISK_ACKNOWLEDGEMENT",
} as const;

export async function getActivePolicyVersion(policyKey: string, fallbackVersion: string): Promise<string> {
  const row = await prisma.policyVersion.findFirst({
    where: { policyKey, isActive: true },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
    select: { version: true },
  });
  return row?.version ?? fallbackVersion;
}

export async function getCheckoutLegalVersions() {
  const [agreementVersion, contractVersion, riskVersion] = await Promise.all([
    getActivePolicyVersion(POLICY_KEYS.CHECKOUT_AGREEMENT, "v1.0"),
    getActivePolicyVersion(POLICY_KEYS.SOURCING_CONTRACT, "v1.0"),
    getActivePolicyVersion(POLICY_KEYS.RISK_ACKNOWLEDGEMENT, "v1.0"),
  ]);
  return { agreementVersion, contractVersion, riskVersion };
}

export function requiresSourcingContract(sourceType: SourceType | null | undefined): boolean {
  return sourceType === "IN_CHINA";
}

export function requiresRiskAcknowledgement(sourceType: SourceType | null | undefined): boolean {
  return sourceType === "IN_CHINA" || sourceType === "IN_TRANSIT";
}

