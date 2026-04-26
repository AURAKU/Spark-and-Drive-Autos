import type { Part } from "@prisma/client";

export type PartOptionsLists = {
  colors: string[];
  sizes: string[];
  types: string[];
};

export type SelectedPartOptions = {
  color?: string;
  size?: string;
  partType?: string;
};

type MetaShape = {
  options?: {
    colors?: string[];
    sizes?: string[];
    types?: string[];
  };
  [key: string]: unknown;
};

/** Parse storefront option lists from Part.metaJson (admin-managed). */
export function parsePartOptionsMeta(metaJson: Part["metaJson"]): PartOptionsLists {
  if (metaJson == null || typeof metaJson !== "object" || Array.isArray(metaJson)) {
    return { colors: [], sizes: [], types: [] };
  }
  const m = metaJson as MetaShape;
  const opt = m.options;
  const take = (v: unknown): string[] => {
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);
  };
  return {
    colors: take(opt?.colors),
    sizes: take(opt?.sizes),
    // Product type is intentionally not exposed as a customer-pick option.
    types: [],
  };
}

/** Merge option lists into existing metaJson (preserves other keys). */
export function mergePartMetaWithOptions(
  existing: Part["metaJson"],
  lists: PartOptionsLists,
): Record<string, unknown> {
  const base =
    existing != null && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  base.options = {
    colors: lists.colors,
    sizes: lists.sizes,
    types: lists.types,
  };
  return base;
}

export function linesToList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function computeVariantKey(opts: SelectedPartOptions): string {
  const c = opts.color?.trim() ?? "";
  const s = opts.size?.trim() ?? "";
  const t = opts.partType?.trim() ?? "";
  if (!c && !s && !t) return "default";
  return `v:${encodeURIComponent(c)}|${encodeURIComponent(s)}|${encodeURIComponent(t)}`;
}

export function formatOptionsLine(opts: SelectedPartOptions): string | null {
  const parts: string[] = [];
  if (opts.color) parts.push(`Color: ${opts.color}`);
  if (opts.size) parts.push(`Size: ${opts.size}`);
  if (opts.partType) parts.push(`Type: ${opts.partType}`);
  return parts.length ? parts.join(" · ") : null;
}

/** Ensure selected values exist in admin allow-lists (if lists are non-empty). */
export function validateSelectionAgainstPart(
  lists: PartOptionsLists,
  sel: SelectedPartOptions,
): { ok: true } | { ok: false; error: string } {
  if (lists.colors.length > 0) {
    if (!sel.color?.trim()) return { ok: false, error: "Choose a color." };
    if (!lists.colors.includes(sel.color.trim())) return { ok: false, error: "Invalid color selection." };
  }
  if (lists.sizes.length > 0) {
    if (!sel.size?.trim()) return { ok: false, error: "Choose a size." };
    if (!lists.sizes.includes(sel.size.trim())) return { ok: false, error: "Invalid size selection." };
  }
  if (lists.types.length > 0) {
    if (!sel.partType?.trim()) return { ok: false, error: "Choose a type." };
    if (!lists.types.includes(sel.partType.trim())) return { ok: false, error: "Invalid type selection." };
  }
  return { ok: true };
}

export function optionsFromCartRow(row: {
  optColor: string | null;
  optSize: string | null;
  optType: string | null;
}): SelectedPartOptions {
  return {
    color: row.optColor ?? undefined,
    size: row.optSize ?? undefined,
    partType: row.optType ?? undefined,
  };
}
