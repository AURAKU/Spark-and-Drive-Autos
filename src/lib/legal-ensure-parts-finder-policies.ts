import { Prisma } from "@prisma/client";

import { POLICY_KEYS } from "@/lib/legal-enforcement";
import { SUGGESTED_POLICY_DEFAULTS } from "@/lib/legal-policy-suggested-defaults";
import { prisma } from "@/lib/prisma";

const KEYS = [POLICY_KEYS.PLATFORM_TERMS_PRIVACY, POLICY_KEYS.PARTS_FINDER_DISCLAIMER] as const;

/**
 * Guarantees both policies required for Parts Finder activation exist and are active.
 * Uses suggested default copy when nothing is published yet (first deploy / empty DB).
 */
export async function ensurePartsFinderActivationPolicyVersions(opts?: {
  actorUserId?: string | null;
}): Promise<void> {
  for (const policyKey of KEYS) {
    await ensureSingleActivePolicy(policyKey, opts?.actorUserId);
  }
}

async function ensureSingleActivePolicy(policyKey: (typeof KEYS)[number], actorUserId?: string | null) {
  const active = await prisma.policyVersion.findFirst({
    where: { policyKey, isActive: true },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  if (active) return;

  const defaults = SUGGESTED_POLICY_DEFAULTS[policyKey];
  if (!defaults) {
    throw new Error(`No bundled default content for policy key: ${policyKey}`);
  }

  const existingV10 = await prisma.policyVersion.findUnique({
    where: { policyKey_version: { policyKey, version: "v1.0" } },
    select: { id: true },
  });

  if (existingV10) {
    await prisma.$transaction([
      prisma.policyVersion.updateMany({ where: { policyKey }, data: { isActive: false } }),
      prisma.policyVersion.update({
        where: { id: existingV10.id },
        data: { isActive: true },
      }),
    ]);
    return;
  }

  try {
    await prisma.policyVersion.create({
      data: {
        policyKey,
        version: "v1.0",
        title: defaults.title,
        content: defaults.content,
        isActive: true,
        createdById: actorUserId ?? undefined,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const row = await prisma.policyVersion.findUnique({
        where: { policyKey_version: { policyKey, version: "v1.0" } },
        select: { id: true },
      });
      if (row) {
        await prisma.$transaction([
          prisma.policyVersion.updateMany({ where: { policyKey }, data: { isActive: false } }),
          prisma.policyVersion.update({ where: { id: row.id }, data: { isActive: true } }),
        ]);
        return;
      }
    }
    throw e;
  }
}
