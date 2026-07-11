export type AdminOverrideTarget =
  | "customsValueGhs"
  | "cifGhs"
  | "fobGhs"
  | "freightGhs"
  | "insuranceGhs"
  | "hsCode"
  | "fxRate"
  | `charge:${string}`;

export type AdminOverrideRecord = {
  target: AdminOverrideTarget;
  originalValue: string | number | null;
  overrideValue: string | number;
  reason: string;
  adminId: string;
  adminDisplayName?: string;
  appliedAt: string;
};

export type OverrideAuditSnapshot = {
  overrides: AdminOverrideRecord[];
  snapshotOnly: true;
};

export type ValueOverrideFields = {
  fobGhs?: number;
  freightGhs?: number;
  insuranceGhs?: number;
  cifGhs?: number;
  customsValueGhs?: number;
  hsCodeOverride?: string;
  fxRate?: number;
};

const VALUE_TARGETS = new Set<AdminOverrideTarget>([
  "customsValueGhs",
  "cifGhs",
  "fobGhs",
  "freightGhs",
  "insuranceGhs",
  "hsCode",
  "fxRate",
]);

function toNumber(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}

export function isChargeOverrideTarget(target: AdminOverrideTarget): boolean {
  return target.startsWith("charge:");
}

export function chargeKeyFromTarget(target: AdminOverrideTarget): string | null {
  if (!isChargeOverrideTarget(target)) return null;
  return target.slice("charge:".length);
}

export function buildOverrideAuditSnapshot(records: AdminOverrideRecord[]): OverrideAuditSnapshot {
  return {
    overrides: records.map((record) => ({ ...record })),
    snapshotOnly: true,
  };
}

export function applyValueOverrides(
  base: ValueOverrideFields,
  records: AdminOverrideRecord[],
): ValueOverrideFields {
  const next = { ...base };

  for (const record of records) {
    if (!VALUE_TARGETS.has(record.target)) continue;

    if (record.target === "hsCode") {
      next.hsCodeOverride = String(record.overrideValue);
      continue;
    }

    if (record.target === "fxRate") {
      next.fxRate = toNumber(record.overrideValue);
      continue;
    }

    const valueTarget = record.target as Exclude<
      AdminOverrideTarget,
      "hsCode" | "fxRate" | `charge:${string}`
    >;
    next[valueTarget] = toNumber(record.overrideValue);
  }

  return next;
}

export function buildChargeOverrideMap(records: AdminOverrideRecord[]): Record<string, number> {
  const map: Record<string, number> = {};

  for (const record of records) {
    const chargeKey = chargeKeyFromTarget(record.target);
    if (!chargeKey) continue;
    map[chargeKey] = toNumber(record.overrideValue);
  }

  return map;
}

export function mergeLegacyChargeOverrides(
  structured: Record<string, number>,
  legacy?: Record<string, number>,
): Record<string, number> {
  if (!legacy) return structured;
  return { ...legacy, ...structured };
}

export function summarizeOverrideAudit(records: AdminOverrideRecord[]): {
  count: number;
  adminIds: string[];
  targets: AdminOverrideTarget[];
} {
  return {
    count: records.length,
    adminIds: [...new Set(records.map((r) => r.adminId))],
    targets: records.map((r) => r.target),
  };
}

export function formatOverrideValue(value: string | number | null): string | null {
  if (value == null) return null;
  if (typeof value === "number") return value.toString();
  return value;
}
