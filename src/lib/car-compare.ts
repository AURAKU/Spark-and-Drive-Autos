/** Client-safe compare list + compare page URL / row helpers (no Prisma / no Node APIs). */

import { z } from "zod";

import type { EngineType, SourceType } from "@prisma/client";

export const CAR_COMPARE_STORAGE_KEY = "sda_car_compare_v1";
export const CAR_COMPARE_MAX = 2;
export const CAR_COMPARE_SPEC_PAGE_SIZE = 12;

/** Displayed when one side has a value and the other does not. */
export const COMPARE_NOT_PROVIDED = "Not provided";

const SLUG_MAX = 160;
const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(SLUG_MAX)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, "Invalid vehicle identifier");

export type CarCompareEntry = {
  id: string;
  slug: string;
  title: string;
  brand: string;
  year: number;
  coverImageUrl: string | null;
};

export type CarCompareRow = {
  key: string;
  label: string;
  left: string;
  right: string;
  /** When values differ, highlight for quick scanning. */
  differs: boolean;
};

export type CompareCarSummary = {
  slug: string;
  title: string;
  brand: string;
  year: number;
  coverImageUrl: string | null;
  priceLabel: string;
};

export type CompareCarsQueryResult =
  | { status: "empty" }
  | { status: "one"; slug: string }
  | { status: "duplicate"; slug: string }
  | { status: "invalid" }
  | { status: "pair"; slugs: [string, string] };

export function buildComparePageHref(slugs: [string, string], page = 1): string {
  const params = new URLSearchParams();
  params.set("cars", `${slugs[0]},${slugs[1]}`);
  if (page > 1) params.set("page", String(page));
  return `/compare?${params.toString()}`;
}

export function buildCompareHrefFromEntries(entries: CarCompareEntry[]): string | null {
  if (entries.length !== CAR_COMPARE_MAX) return null;
  return buildComparePageHref([entries[0]!.slug, entries[1]!.slug]);
}

export function parseCompareCarsParam(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  return decoded
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function normalizeCompareSlugs(slugs: string[]): [string, string] | null {
  const unique = [...new Set(slugs.map((s) => s.trim()).filter(Boolean))];
  if (unique.length !== 2) return null;
  return [unique[0]!, unique[1]!];
}

/**
 * Zod-validated comparison query parser.
 * Deterministic: more than two unique slugs → first two unique valid slugs.
 */
export function resolveCompareCarsQuery(raw: string | undefined): CompareCarsQueryResult {
  const tokens = parseCompareCarsParam(raw);
  if (tokens.length === 0) return { status: "empty" };

  const validated: string[] = [];
  for (const token of tokens) {
    const parsed = slugSchema.safeParse(token);
    if (!parsed.success) return { status: "invalid" };
    validated.push(parsed.data);
  }

  if (validated.length === 1) {
    return { status: "one", slug: validated[0]! };
  }

  // Exact duplicate only (same slug twice, nothing else)
  if (validated.length === 2 && validated[0] === validated[1]) {
    return { status: "duplicate", slug: validated[0]! };
  }

  const unique: string[] = [];
  for (const slug of validated) {
    if (!unique.includes(slug)) unique.push(slug);
  }

  if (unique.length === 1) {
    return { status: "duplicate", slug: unique[0]! };
  }

  if (unique.length >= 2) {
    return { status: "pair", slugs: [unique[0]!, unique[1]!] };
  }

  return { status: "invalid" };
}

export function toCarCompareEntry(car: {
  id: string;
  slug: string;
  title: string;
  brand: string;
  year: number;
  coverImageUrl?: string | null;
}): CarCompareEntry {
  return {
    id: car.id,
    slug: car.slug,
    title: car.title,
    brand: car.brand,
    year: car.year,
    coverImageUrl: safeCoverImageUrl(car.coverImageUrl),
  };
}

export function safeCoverImageUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Avoid obvious junk that would crash next/image
  if (trimmed === "null" || trimmed === "undefined") return null;
  return trimmed;
}

export function isMissingCompareValue(value: string): boolean {
  return value === "—" || value === COMPARE_NOT_PROVIDED || value.trim() === "";
}

function displayOrDash(value: string | number | boolean | null | undefined | unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") {
    const s = value.trim();
    return s.length > 0 ? s : "—";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "—";
  }
  if (typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object") {
    try {
      const json = JSON.stringify(value);
      return json && json !== "{}" && json !== "[]" ? json : "—";
    } catch {
      return "—";
    }
  }
  const s = String(value).trim();
  return s.length > 0 ? s : "—";
}

export function decimalToNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === "object" && value !== null && "toString" in value) {
    const n = Number(String(value));
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const SOURCE_LABEL: Record<string, string> = {
  IN_GHANA: "Ghana stock",
  IN_CHINA: "China source",
  IN_TRANSIT: "In transit",
};

function formatMileage(mileage: number | null | undefined): string {
  if (mileage == null || !Number.isFinite(mileage)) return "—";
  try {
    return `${mileage.toLocaleString()} km`;
  } catch {
    return `${mileage} km`;
  }
}

function parseSpecificationsMap(raw: unknown): Record<string, string> {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return parseSpecificationsMap(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  if (Array.isArray(raw)) {
    const out: Record<string, string> = {};
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const label = "label" in item ? String((item as { label?: unknown }).label ?? "").trim() : "";
      const value = "value" in item ? (item as { value?: unknown }).value : undefined;
      if (!label) continue;
      out[label] = displayOrDash(value);
    }
    return out;
  }
  if (typeof raw === "object") {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const k = key.trim();
      if (!k) continue;
      out[k] = displayOrDash(value);
    }
    return out;
  }
  return {};
}

function normalizeSideValues(leftVal: string, rightVal: string): { left: string; right: string } | null {
  const leftMissing = isMissingCompareValue(leftVal);
  const rightMissing = isMissingCompareValue(rightVal);
  if (leftMissing && rightMissing) return null;
  return {
    left: leftMissing ? COMPARE_NOT_PROVIDED : leftVal,
    right: rightMissing ? COMPARE_NOT_PROVIDED : rightVal,
  };
}

/** Build a unified, paginated comparison table from two public car records. */
export function buildCarCompareRows(
  left: CompareCarRecord,
  right: CompareCarRecord,
  formatPrice: (car: CompareCarRecord) => string,
  engineLabel: (engineType: EngineType | string) => string,
): CarCompareRow[] {
  const rows: CarCompareRow[] = [];

  function push(key: string, label: string, leftRaw: string, rightRaw: string, opts?: { alwaysShow?: boolean }) {
    const normalized = normalizeSideValues(leftRaw, rightRaw);
    if (!normalized) {
      if (opts?.alwaysShow) {
        rows.push({
          key,
          label,
          left: COMPARE_NOT_PROVIDED,
          right: COMPARE_NOT_PROVIDED,
          differs: false,
        });
      }
      return;
    }
    rows.push({
      key,
      label,
      left: normalized.left,
      right: normalized.right,
      differs: normalized.left !== normalized.right,
    });
  }

  push("price", "List price", formatPrice(left), formatPrice(right), { alwaysShow: true });
  push("brand", "Brand", displayOrDash(left.brand), displayOrDash(right.brand), { alwaysShow: true });
  push("model", "Model", displayOrDash(left.model), displayOrDash(right.model));
  push("year", "Year", displayOrDash(left.year), displayOrDash(right.year), { alwaysShow: true });
  push("trim", "Trim", displayOrDash(left.trim), displayOrDash(right.trim));
  push("body", "Body type", displayOrDash(left.bodyType), displayOrDash(right.bodyType));
  push(
    "source",
    "Source",
    SOURCE_LABEL[left.sourceType] ?? displayOrDash(left.sourceType),
    SOURCE_LABEL[right.sourceType] ?? displayOrDash(right.sourceType),
  );
  push("location", "Location", displayOrDash(left.location), displayOrDash(right.location));
  push("engine", "Powertrain", engineLabel(left.engineType), engineLabel(right.engineType));
  push("transmission", "Transmission", displayOrDash(left.transmission), displayOrDash(right.transmission));
  push("drivetrain", "Drivetrain", displayOrDash(left.drivetrain), displayOrDash(right.drivetrain));
  push("mileage", "Mileage", formatMileage(left.mileage), formatMileage(right.mileage));
  push("exterior", "Exterior color", displayOrDash(left.colorExterior), displayOrDash(right.colorExterior));
  push("interior", "Interior color", displayOrDash(left.colorInterior), displayOrDash(right.colorInterior));
  push("condition", "Condition", displayOrDash(left.condition), displayOrDash(right.condition));
  push("inspection", "Inspection", displayOrDash(left.inspectionStatus), displayOrDash(right.inspectionStatus));
  push("delivery", "Delivery window", displayOrDash(left.estimatedDelivery), displayOrDash(right.estimatedDelivery));
  push(
    "vin",
    "VIN / chassis",
    displayOrDash(left.vin ?? "Available on request"),
    displayOrDash(right.vin ?? "Available on request"),
  );

  const leftShip = (() => {
    const n = decimalToNumber(left.seaShippingFeeGhs);
    return n > 0 ? `GHS ${n.toLocaleString()}` : "—";
  })();
  const rightShip = (() => {
    const n = decimalToNumber(right.seaShippingFeeGhs);
    return n > 0 ? `GHS ${n.toLocaleString()}` : "—";
  })();
  push("shipping", "Sea shipping (est.)", leftShip, rightShip);

  push("short_desc", "Summary", displayOrDash(left.shortDescription), displayOrDash(right.shortDescription));

  const leftSpecs = Array.isArray(left.specs) ? left.specs : [];
  const rightSpecs = Array.isArray(right.specs) ? right.specs : [];

  const specLabels = new Set<string>();
  for (const s of leftSpecs) {
    if (s?.label?.trim()) specLabels.add(s.label.trim());
  }
  for (const s of rightSpecs) {
    if (s?.label?.trim()) specLabels.add(s.label.trim());
  }

  const leftSpecMap = new Map(
    leftSpecs.filter((s) => s?.label?.trim()).map((s) => [s.label.trim(), s.value] as const),
  );
  const rightSpecMap = new Map(
    rightSpecs.filter((s) => s?.label?.trim()).map((s) => [s.label.trim(), s.value] as const),
  );

  for (const label of [...specLabels].sort((a, b) => a.localeCompare(b))) {
    push(`spec:${label}`, label, displayOrDash(leftSpecMap.get(label)), displayOrDash(rightSpecMap.get(label)));
  }

  const leftHighlights = parseSpecificationsMap(left.specifications);
  const rightHighlights = parseSpecificationsMap(right.specifications);
  const highlightKeys = new Set([...Object.keys(leftHighlights), ...Object.keys(rightHighlights)]);

  for (const key of [...highlightKeys].sort((a, b) => a.localeCompare(b))) {
    push(`highlight:${key}`, key, displayOrDash(leftHighlights[key]), displayOrDash(rightHighlights[key]));
  }

  return rows;
}

/** Assert props for client CarCompareView are plain JSON-serializable (no functions / Decimal / Date). */
export function assertCompareClientPayloadSerializable(payload: unknown): void {
  JSON.stringify(payload, (_key, value) => {
    if (typeof value === "function") {
      throw new Error("Non-serializable function in compare payload");
    }
    if (typeof value === "bigint") {
      throw new Error("Non-serializable bigint in compare payload");
    }
    if (value instanceof Date) {
      throw new Error("Non-serializable Date in compare payload");
    }
    return value;
  });
}

export type CompareCarRecord = {
  slug: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  trim: string | null;
  bodyType: string | null;
  engineType: EngineType;
  transmission: string | null;
  drivetrain: string | null;
  mileage: number | null;
  colorExterior: string | null;
  colorInterior: string | null;
  vin: string | null;
  condition: string | null;
  inspectionStatus: string | null;
  estimatedDelivery: string | null;
  seaShippingFeeGhs: unknown;
  sourceType: SourceType;
  location: string | null;
  shortDescription: string | null;
  coverImageUrl: string | null;
  basePriceRmb: unknown;
  specs: Array<{ label: string; value: string }>;
  specifications: unknown;
};
