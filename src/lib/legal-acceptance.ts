import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const ACCEPTANCE_CONTEXT = {
  CHECKOUT: "CHECKOUT",
  PAYMENT: "PAYMENT",
  VERIFICATION: "VERIFICATION",
  LOGIN: "LOGIN",
  LOGIN_REACCEPTANCE: "LOGIN_REACCEPTANCE",
  SOURCING: "SOURCING",
  PARTS_FINDER_ACTIVATION: "PARTS_FINDER_ACTIVATION",
  PARTS_FINDER_SEARCH: "PARTS_FINDER_SEARCH",
  SOURCING_REQUEST: "SOURCING_REQUEST",
  REGISTRATION: "REGISTRATION",
  ADMIN: "ADMIN",
} as const;

export type AcceptanceContext = (typeof ACCEPTANCE_CONTEXT)[keyof typeof ACCEPTANCE_CONTEXT];

function snapshotFromPolicy(row: { title: string | null; content: string | null; version: string; policyKey: string }) {
  const head = row.title?.trim() || row.policyKey;
  const body = row.content?.trim() || "";
  return `${head}\n\nVersion ${row.version}\n\n${body}`.trim();
}

export async function recordUserPolicyAcceptance(opts: {
  userId: string;
  policyVersionId: string;
  context: AcceptanceContext;
  ipAddress?: string | null;
  userAgent?: string | null;
  tx?: Prisma.TransactionClient;
}) {
  const db = opts.tx ?? prisma;
  const pv = await db.policyVersion.findUnique({
    where: { id: opts.policyVersionId },
    select: { id: true, policyKey: true, version: true, title: true, content: true },
  });
  if (!pv) throw new Error("POLICY_VERSION_NOT_FOUND");

  await db.userPolicyAcceptance.create({
    data: {
      userId: opts.userId,
      policyVersionId: pv.id,
      context: opts.context,
      acceptanceTextSnapshot: snapshotFromPolicy(pv),
      ipAddress: opts.ipAddress ?? null,
      userAgent: opts.userAgent ? opts.userAgent.slice(0, 512) : null,
    },
  });
}

export async function userHasAcceptedPolicyVersion(opts: {
  userId: string;
  policyVersionId: string;
}): Promise<boolean> {
  const hit = await prisma.userPolicyAcceptance.findFirst({
    where: { userId: opts.userId, policyVersionId: opts.policyVersionId },
    select: { id: true },
  });
  return Boolean(hit);
}

export async function getActivePolicyRow(policyKey: string) {
  return prisma.policyVersion.findFirst({
    where: { policyKey, isActive: true },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function recordUserContractAcceptance(opts: {
  userId: string;
  contractId: string | null;
  contractVersion: string;
  orderId?: string | null;
  context: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  acceptanceTextSnapshot?: string | null;
  tx?: Prisma.TransactionClient;
}) {
  const db = opts.tx ?? prisma;
  const contract = opts.contractId
    ? await db.contract.findUnique({
        where: { id: opts.contractId },
        select: { id: true, type: true, title: true, content: true, version: true },
      })
    : null;
  const snapshot =
    opts.acceptanceTextSnapshot?.trim() ||
    (contract
      ? `${contract.title?.trim() || contract.type}\n\nVersion ${contract.version}\n\n${contract.content}`.trim()
      : `Contract version ${opts.contractVersion}`.trim());

  await db.contractAcceptance.create({
    data: {
      userId: opts.userId,
      contractId: contract?.id ?? opts.contractId,
      orderId: opts.orderId ?? null,
      contractVersion: opts.contractVersion,
      context: opts.context,
      ipAddress: opts.ipAddress ?? null,
      userAgent: opts.userAgent ? opts.userAgent.slice(0, 512) : null,
      acceptanceTextSnapshot: snapshot,
    },
  });
}
