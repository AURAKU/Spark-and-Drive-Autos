import { prisma } from "@/lib/prisma";
import { SOURCING_CONTRACT_TYPES } from "@/lib/legal-enforcement";

export type UserLegalPolicyStatus = {
  kind: "policy";
  id: string;
  key: string;
  title: string;
  version: string;
  effectiveAt: Date;
  accepted: boolean;
};

export type UserLegalContractStatus = {
  kind: "contract";
  id: string;
  key: string;
  title: string;
  version: string;
  effectiveAt: Date;
  accepted: boolean;
};

export type UserLegalStatusRow = UserLegalPolicyStatus | UserLegalContractStatus;

function policyTitle(input: { title: string | null; policyKey: string }) {
  return input.title?.trim() || input.policyKey;
}

function contractTitle(input: { title: string | null; type: string }) {
  return input.title?.trim() || input.type;
}

export async function getUserLegalStatusRows(userId: string): Promise<UserLegalStatusRow[]> {
  const activePolicies = await prisma.policyVersion.findMany({
    where: { isActive: true },
    orderBy: [{ policyKey: "asc" }, { effectiveAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      policyKey: true,
      title: true,
      version: true,
      effectiveAt: true,
    },
  });
  const latestPolicyByKey = new Map<string, (typeof activePolicies)[number]>();
  for (const row of activePolicies) {
    if (!latestPolicyByKey.has(row.policyKey)) latestPolicyByKey.set(row.policyKey, row);
  }
  const latestPolicies = [...latestPolicyByKey.values()];

  const activeContracts = await prisma.contract.findMany({
    where: { isActive: true, type: { in: [...SOURCING_CONTRACT_TYPES] } },
    orderBy: [{ type: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      type: true,
      title: true,
      version: true,
      createdAt: true,
    },
  });
  const latestContractByType = new Map<string, (typeof activeContracts)[number]>();
  for (const row of activeContracts) {
    if (!latestContractByType.has(row.type)) latestContractByType.set(row.type, row);
  }
  const latestContracts = [...latestContractByType.values()];

  const [policyAccepts, contractAccepts] = await Promise.all([
    prisma.userPolicyAcceptance.findMany({
      where: { userId, policyVersionId: { in: latestPolicies.map((p) => p.id) } },
      select: { policyVersionId: true },
    }),
    prisma.contractAcceptance.findMany({
      where: { userId, contractId: { in: latestContracts.map((c) => c.id) } },
      select: { contractId: true },
    }),
  ]);
  const acceptedPolicyIds = new Set(policyAccepts.map((row) => row.policyVersionId));
  const acceptedContractIds = new Set(contractAccepts.map((row) => row.contractId).filter((v): v is string => Boolean(v)));

  const rows: UserLegalStatusRow[] = [
    ...latestPolicies.map((row) => ({
      kind: "policy" as const,
      id: row.id,
      key: row.policyKey,
      title: policyTitle(row),
      version: row.version,
      effectiveAt: row.effectiveAt,
      accepted: acceptedPolicyIds.has(row.id),
    })),
    ...latestContracts.map((row) => ({
      kind: "contract" as const,
      id: row.id,
      key: row.type,
      title: contractTitle(row),
      version: row.version,
      effectiveAt: row.createdAt,
      accepted: acceptedContractIds.has(row.id),
    })),
  ];

  rows.sort((a, b) => Number(a.accepted) - Number(b.accepted) || a.key.localeCompare(b.key));
  return rows;
}
