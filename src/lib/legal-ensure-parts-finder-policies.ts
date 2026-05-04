import { Prisma } from "@prisma/client";

import { POLICY_KEYS } from "@/lib/legal-enforcement";
import { SUGGESTED_POLICY_DEFAULTS } from "@/lib/legal-policy-suggested-defaults";
import { prisma } from "@/lib/prisma";

const KEYS = [POLICY_KEYS.PLATFORM_TERMS_PRIVACY, POLICY_KEYS.PARTS_FINDER_DISCLAIMER] as const;

const BOOTSTRAP_VERSION = "v1.0";

export type EnsurePartsFinderPoliciesResult = { ok: true } | { ok: false; reason: string; code?: string };

/**
 * Guarantees both policies required for Parts Finder activation exist and are active.
 * Uses suggested default copy when nothing is published yet (first deploy / empty DB).
 *
 * Uses `upsert` on the compound unique (`policyKey`, `version`) so concurrent requests /
 * PM2 cluster workers cannot race on `create()` and hit unique constraint P2002.
 *
 * Never throws — callers (RSC / API) stay up if the DB is down or content is missing.
 */
export async function ensurePartsFinderActivationPolicyVersions(opts?: {
  actorUserId?: string | null;
}): Promise<EnsurePartsFinderPoliciesResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.warn("[legal-ensure-parts-finder] skipped: DATABASE_URL is not set");
    return { ok: false, reason: "database_url_missing" };
  }

  try {
    for (const policyKey of KEYS) {
      const single = await ensureSingleActivePolicy(policyKey, opts?.actorUserId);
      if (!single.ok) return single;
    }
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientInitializationError) {
      console.error("[legal-ensure-parts-finder] DB unavailable at initialization");
      return { ok: false, reason: "db_initialization", code: "INITIALIZATION" };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[legal-ensure-parts-finder] Prisma error", e.code, e.message);
      return { ok: false, reason: "prisma_error", code: e.code };
    }
    console.error("[legal-ensure-parts-finder] failed", e instanceof Error ? e.message : e);
    return { ok: false, reason: "unknown_error" };
  }
}

async function ensureSingleActivePolicy(
  policyKey: (typeof KEYS)[number],
  actorUserId?: string | null,
): Promise<EnsurePartsFinderPoliciesResult> {
  const active = await prisma.policyVersion.findFirst({
    where: { policyKey, isActive: true },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  if (active) return { ok: true };

  const defaults = SUGGESTED_POLICY_DEFAULTS[policyKey];
  if (!defaults) {
    console.error(`[legal-ensure-parts-finder] No bundled default content for policy key: ${policyKey}`);
    return { ok: false, reason: "missing_default_content" };
  }

  const row = await prisma.policyVersion.upsert({
    where: { policyKey_version: { policyKey, version: BOOTSTRAP_VERSION } },
    create: {
      policyKey,
      version: BOOTSTRAP_VERSION,
      title: defaults.title,
      content: defaults.content,
      isActive: false,
      createdById: actorUserId ?? undefined,
    },
    update: {},
  });

  await prisma.$transaction([
    prisma.policyVersion.updateMany({ where: { policyKey }, data: { isActive: false } }),
    prisma.policyVersion.update({ where: { id: row.id }, data: { isActive: true } }),
  ]);

  return { ok: true };
}
