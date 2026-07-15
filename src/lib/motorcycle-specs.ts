import { z } from "zod";

import { parseSpecificationsText } from "@/lib/motorcycle-spec-parser";

/** Structured specification row for admin create/edit (Zod-validated). */
export const motorcycleSpecRowSchema = z.object({
  groupName: z
    .preprocess((v) => (v === "" || v == null ? undefined : v), z.string().max(80).optional())
    .optional(),
  label: z.string().min(1).max(120),
  value: z.string().min(1).max(500),
  unit: z
    .preprocess((v) => (v === "" || v == null ? undefined : v), z.string().max(40).optional())
    .optional(),
  sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
  isPublic: z.boolean().default(true),
});

export type MotorcycleSpecRowInput = z.infer<typeof motorcycleSpecRowSchema>;

export const motorcycleSpecsArraySchema = z.array(motorcycleSpecRowSchema).max(200);

/** Parse FormData `specificationsJson` or fall back to plain-text lines. */
export function resolveMotorcycleSpecRows(input: {
  specificationsJson?: string | null;
  specificationsText?: string | null;
}): MotorcycleSpecRowInput[] {
  const rawJson = input.specificationsJson?.trim();
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as unknown;
      const result = motorcycleSpecsArraySchema.safeParse(parsed);
      if (result.success) {
        return result.data.map((row, i) => ({
          ...row,
          sortOrder: row.sortOrder ?? i,
        }));
      }
    } catch {
      // fall through to text
    }
  }
  return parseSpecificationsText(input.specificationsText).map((r) => ({
    label: r.label,
    value: r.value,
    sortOrder: r.sortOrder,
    isPublic: true as const,
  }));
}

/** Rebuild plain-text blob from structured rows (for searching / legacy field). */
export function specsToPlainText(rows: MotorcycleSpecRowInput[]): string {
  return rows
    .map((r) => {
      const unit = r.unit?.trim() ? ` ${r.unit.trim()}` : "";
      const group = r.groupName?.trim() ? `[${r.groupName.trim()}] ` : "";
      return `${group}${r.label}: ${r.value}${unit}`.trim();
    })
    .join("\n");
}

export function groupPublicSpecs<T extends { groupName?: string | null; isPublic?: boolean }>(
  rows: T[],
): { group: string | null; items: T[] }[] {
  const publicRows = rows.filter((r) => r.isPublic !== false);
  const order: string[] = [];
  const map = new Map<string, T[]>();
  for (const row of publicRows) {
    const key = row.groupName?.trim() || "";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(row);
  }
  return order.map((key) => ({
    group: key || null,
    items: map.get(key)!,
  }));
}
