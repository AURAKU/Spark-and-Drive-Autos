import { POLICY_KEYS } from "@/lib/legal-enforcement";
import { SUGGESTED_POLICY_DEFAULTS, SUGGESTED_VEHICLE_PARTS_SOURCING_CONTRACT } from "@/lib/legal-policy-suggested-defaults";
import { prisma } from "@/lib/prisma";

export type PolicyFormDefaults = {
  policyKey: string;
  version: string;
  title: string;
  content: string;
  isActive: boolean;
  sourceId: string | null;
};

export type ContractFormDefaults = {
  type: string;
  title: string;
  version: string;
  content: string;
  isActive: boolean;
  sourceId: string | null;
};

/** Default policy form key when none is in the URL (used to load the latest entry as a template). */
export const DEFAULT_ADMIN_POLICY_KEY = POLICY_KEYS.CHECKOUT_AGREEMENT;
export const DEFAULT_ADMIN_CONTRACT_TYPE = "VEHICLE_PARTS_SOURCING_CONTRACT";

function blankPolicyForKey(key: string): PolicyFormDefaults {
  const sug = SUGGESTED_POLICY_DEFAULTS[key];
  return {
    policyKey: key,
    version: "",
    title: sug?.title ?? "",
    content: sug?.content ?? "",
    isActive: true,
    sourceId: null,
  };
}

function blankContractForType(t: string): ContractFormDefaults {
  const useSourcingDefault = t === DEFAULT_ADMIN_CONTRACT_TYPE || t === "CAR_SOURCING";
  return {
    type: t,
    title: useSourcingDefault ? SUGGESTED_VEHICLE_PARTS_SOURCING_CONTRACT.title : "",
    version: "",
    content: useSourcingDefault ? SUGGESTED_VEHICLE_PARTS_SOURCING_CONTRACT.content : "",
    isActive: true,
    sourceId: null,
  };
}

/**
 * Resolves the row to prefill the "Save policy version" form (template for a new version).
 * Prefer `policyVersionId` (exact history row), else latest for `policyKey`, else `null` (blank form).
 */
export async function resolvePolicyFormTemplate(opts: {
  policyVersionId?: string | null;
  policyKey?: string | null;
}): Promise<PolicyFormDefaults | null> {
  if (opts.policyVersionId) {
    const row = await prisma.policyVersion.findUnique({ where: { id: opts.policyVersionId } });
    if (row) {
      return {
        policyKey: row.policyKey,
        version: row.version,
        title: row.title ?? "",
        content: row.content ?? "",
        isActive: row.isActive,
        sourceId: row.id,
      };
    }
    return null;
  }
  const key = (opts.policyKey && opts.policyKey.trim()) || DEFAULT_ADMIN_POLICY_KEY;
  const row = await prisma.policyVersion.findFirst({
    where: { policyKey: key },
    orderBy: [{ createdAt: "desc" }, { effectiveAt: "desc" }],
  });
  if (!row) {
    return blankPolicyForKey(key);
  }
  return {
    policyKey: row.policyKey,
    version: row.version,
    title: row.title ?? "",
    content: row.content ?? "",
    isActive: row.isActive,
    sourceId: row.id,
  };
}

/**
 * Resolves the contract row to prefill the "Save contract" form (template for a new version).
 * Prefer `contractId`, else latest for `contractType`, else a blank row with default type.
 */
export async function resolveContractFormTemplate(opts: {
  contractId?: string | null;
  contractType?: string | null;
}): Promise<ContractFormDefaults | null> {
  if (opts.contractId) {
    const row = await prisma.contract.findUnique({ where: { id: opts.contractId } });
    if (row) {
      return {
        type: row.type,
        title: row.title ?? "",
        version: row.version,
        content: row.content,
        isActive: row.isActive,
        sourceId: row.id,
      };
    }
    return null;
  }
  const t = (opts.contractType && opts.contractType.trim()) || DEFAULT_ADMIN_CONTRACT_TYPE;
  const row = await prisma.contract.findFirst({
    where: { type: t },
    orderBy: { createdAt: "desc" },
  });
  if (!row) {
    return blankContractForType(t);
  }
  return {
    type: row.type,
    title: row.title ?? "",
    version: row.version,
    content: row.content,
    isActive: row.isActive,
    sourceId: row.id,
  };
}
