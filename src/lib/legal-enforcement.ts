import { SourceType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Canonical policy keys (versioned in `PolicyVersion`). */
export const POLICY_KEYS = {
  PLATFORM_TERMS: "PLATFORM_TERMS",
  PRIVACY_POLICY: "PRIVACY_POLICY",
  PLATFORM_TERMS_PRIVACY: "PLATFORM_TERMS_PRIVACY",
  CHECKOUT_AGREEMENT: "CHECKOUT_AGREEMENT",
  PARTS_FINDER_DISCLAIMER: "PARTS_FINDER_DISCLAIMER",
  VERIFIED_PART_REQUEST_TERMS: "VERIFIED_PART_REQUEST_TERMS",
  SOURCING_RISK_ACKNOWLEDGEMENT: "SOURCING_RISK_ACKNOWLEDGEMENT",
  VEHICLE_SOURCING_CONTRACT: "VEHICLE_SOURCING_CONTRACT",
  IDENTITY_VERIFICATION_CONSENT: "IDENTITY_VERIFICATION_CONSENT",
  PAYMENT_CONFIRMATION_NOTICE: "PAYMENT_CONFIRMATION_NOTICE",
  REFUND_POLICY: "REFUND_POLICY",
  /** @deprecated Prefer SOURCING_RISK_ACKNOWLEDGEMENT — kept for legacy active rows */
  RISK_ACKNOWLEDGEMENT: "RISK_ACKNOWLEDGEMENT",
  DISPUTE_COMPLAINT_PROCESS: "DISPUTE_COMPLAINT_PROCESS",
  PAYMENT_VERIFICATION_POLICY: "PAYMENT_VERIFICATION_POLICY",
  LOGISTICS_CUSTOMS_NOTICE: "LOGISTICS_CUSTOMS_NOTICE",
  REFUND_AND_CANCELLATION_POLICY: "REFUND_AND_CANCELLATION_POLICY",
  /** Fallback label row when no `Contract` record exists yet */
  SOURCING_CONTRACT: "SOURCING_CONTRACT",
} as const;

/** Contract `type` values for vehicle/parts sourcing (see `Contract` model). */
export const SOURCING_CONTRACT_TYPES = ["VEHICLE_PARTS_SOURCING_CONTRACT", "CAR_SOURCING"] as const;

export const DEFAULT_PAYMENT_DISPUTE_NOTE =
  "Payment flagged for internal legal and verification review. Transaction status should not be treated as final until payment provider confirmation, customer evidence, and admin review are completed.";

export async function getActivePolicyVersion(policyKey: string, fallbackVersion: string): Promise<string> {
  const row = await prisma.policyVersion.findFirst({
    where: { policyKey, isActive: true },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
    select: { version: true },
  });
  return row?.version ?? fallbackVersion;
}

export async function getActivePolicyVersionWithFallback(
  policyKeys: readonly string[],
  fallbackVersion: string,
): Promise<string> {
  for (const key of policyKeys) {
    const v = await getActivePolicyVersion(key, "");
    if (v) return v;
  }
  return fallbackVersion;
}

export async function getActiveSourcingContractVersion(): Promise<string> {
  const row = await prisma.contract.findFirst({
    where: { type: { in: [...SOURCING_CONTRACT_TYPES] }, isActive: true },
    orderBy: { createdAt: "desc" },
    select: { version: true },
  });
  if (row?.version) return row.version;
  return getActivePolicyVersion(POLICY_KEYS.SOURCING_CONTRACT, "v1.0");
}

export async function getCheckoutLegalVersions() {
  const [agreementVersion, contractVersion, riskVersion] = await Promise.all([
    getActivePolicyVersion(POLICY_KEYS.CHECKOUT_AGREEMENT, "v1.0"),
    getActiveSourcingContractVersion(),
    getActivePolicyVersionWithFallback(
      [POLICY_KEYS.SOURCING_RISK_ACKNOWLEDGEMENT, POLICY_KEYS.RISK_ACKNOWLEDGEMENT],
      "v1.0",
    ),
  ]);
  return { agreementVersion, contractVersion, riskVersion };
}

export async function getActiveSourcingContractRow() {
  return prisma.contract.findFirst({
    where: { type: { in: [...SOURCING_CONTRACT_TYPES] }, isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, version: true, type: true },
  });
}

export async function getActiveRiskPolicyRow() {
  const primary = await prisma.policyVersion.findFirst({
    where: { policyKey: POLICY_KEYS.SOURCING_RISK_ACKNOWLEDGEMENT, isActive: true },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
  });
  if (primary) return primary;
  return prisma.policyVersion.findFirst({
    where: { policyKey: POLICY_KEYS.RISK_ACKNOWLEDGEMENT, isActive: true },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
  });
}

export function requiresSourcingContract(sourceType: SourceType | null | undefined): boolean {
  return sourceType === "IN_CHINA";
}

export function requiresRiskAcknowledgement(sourceType: SourceType | null | undefined): boolean {
  return sourceType === "IN_CHINA" || sourceType === "IN_TRANSIT";
}

export async function assertVehicleCheckoutLegalVersions(opts: {
  agreementVersion: string;
  contractVersion?: string | null;
  riskVersion?: string | null;
  sourceType: SourceType;
}): Promise<{ ok: true } | { ok: false; code: string }> {
  const legal = await getCheckoutLegalVersions();
  if (opts.agreementVersion !== legal.agreementVersion) {
    return { ok: false, code: "STALE_CHECKOUT_AGREEMENT" };
  }
  if (requiresSourcingContract(opts.sourceType)) {
    if (!opts.contractVersion || opts.contractVersion !== legal.contractVersion) {
      return { ok: false, code: "STALE_SOURCING_CONTRACT" };
    }
  }
  if (requiresRiskAcknowledgement(opts.sourceType)) {
    if (!opts.riskVersion || opts.riskVersion !== legal.riskVersion) {
      return { ok: false, code: "STALE_RISK_ACKNOWLEDGEMENT" };
    }
  }
  return { ok: true };
}

export async function getPartsFinderActivationLegalVersions() {
  const [platformTermsVersion, partsFinderDisclaimerVersion] = await Promise.all([
    getActivePolicyVersion(POLICY_KEYS.PLATFORM_TERMS_PRIVACY, "v1.0"),
    getActivePolicyVersion(POLICY_KEYS.PARTS_FINDER_DISCLAIMER, "v1.0"),
  ]);
  return { platformTermsVersion, partsFinderDisclaimerVersion };
}

export async function assertPartsFinderActivationLegal(opts: {
  platformTermsVersion: string;
  partsFinderDisclaimerVersion: string;
}): Promise<{ ok: true } | { ok: false; code: string }> {
  const v = await getPartsFinderActivationLegalVersions();
  if (opts.platformTermsVersion !== v.platformTermsVersion) return { ok: false, code: "STALE_PLATFORM_TERMS" };
  if (opts.partsFinderDisclaimerVersion !== v.partsFinderDisclaimerVersion) {
    return { ok: false, code: "STALE_PARTS_FINDER_DISCLAIMER" };
  }
  return { ok: true };
}

export async function assertSourcingRequestLegal(opts: {
  riskAckVersion: string;
  contractVersion: string;
}): Promise<{ ok: true } | { ok: false; code: string }> {
  const riskLegal = await getActivePolicyVersionWithFallback(
    [POLICY_KEYS.SOURCING_RISK_ACKNOWLEDGEMENT, POLICY_KEYS.RISK_ACKNOWLEDGEMENT],
    "v1.0",
  );
  const contractLegal = await getActiveSourcingContractVersion();
  if (opts.riskAckVersion !== riskLegal) return { ok: false, code: "STALE_SOURCING_RISK" };
  if (opts.contractVersion !== contractLegal) return { ok: false, code: "STALE_SOURCING_CONTRACT" };
  return { ok: true };
}
