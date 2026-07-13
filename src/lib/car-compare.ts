/** Client-side compare list + compare page URL helpers. */

import type { EngineType, SourceType } from "@prisma/client";

export const CAR_COMPARE_STORAGE_KEY = "sda_car_compare_v1";
export const CAR_COMPARE_MAX = 2;
export const CAR_COMPARE_SPEC_PAGE_SIZE = 12;

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
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function normalizeCompareSlugs(slugs: string[]): [string, string] | null {
  const unique = [...new Set(slugs.map((s) => s.trim()).filter(Boolean))];
  if (unique.length !== 2) return null;
  return [unique[0]!, unique[1]!];
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
    coverImageUrl: car.coverImageUrl?.trim() || null,
  };
}

function displayOrDash(value: string | number | boolean | null | undefined | unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") {
    const s = value.trim();
    return s.length > 0 ? s : "—";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "—";
    }
  }
  const s = String(value).trim();
  return s.length > 0 ? s : "—";
}

function decimalToNumber(value: unknown): number {
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

/** Build a unified, paginated comparison table from two public car records. */
export function buildCarCompareRows(
  left: CompareCarRecord,
  right: CompareCarRecord,
  formatPrice: (car: CompareCarRecord) => string,
  engineLabel: (engineType: EngineType | string) => string,
): CarCompareRow[] {
  const rows: CarCompareRow[] = [];

  function push(key: string, label: string, leftVal: string, rightVal: string) {
    rows.push({
      key,
      label,
      left: leftVal,
      right: rightVal,
      differs: leftVal !== rightVal,
    });
  }

  push("price", "List price", formatPrice(left), formatPrice(right));
  push("brand", "Brand", displayOrDash(left.brand), displayOrDash(right.brand));
  push("model", "Model", displayOrDash(left.model), displayOrDash(right.model));
  push("year", "Year", displayOrDash(left.year), displayOrDash(right.year));
  push("trim", "Trim", displayOrDash(left.trim), displayOrDash(right.trim));
  push("body", "Body type", displayOrDash(left.bodyType), displayOrDash(right.bodyType));
  push("source", "Source", SOURCE_LABEL[left.sourceType] ?? left.sourceType, SOURCE_LABEL[right.sourceType] ?? right.sourceType);
  push("location", "Location", displayOrDash(left.location), displayOrDash(right.location));
  push("engine", "Engine", engineLabel(left.engineType), engineLabel(right.engineType));
  push("transmission", "Transmission", displayOrDash(left.transmission), displayOrDash(right.transmission));
  push("drivetrain", "Drivetrain", displayOrDash(left.drivetrain), displayOrDash(right.drivetrain));
  push(
    "mileage",
    "Mileage",
    left.mileage != null ? `${left.mileage.toLocaleString()} km` : "—",
    right.mileage != null ? `${right.mileage.toLocaleString()} km` : "—",
  );
  push("exterior", "Exterior color", displayOrDash(left.colorExterior), displayOrDash(right.colorExterior));
  push("interior", "Interior color", displayOrDash(left.colorInterior), displayOrDash(right.colorInterior));
  push("condition", "Condition", displayOrDash(left.condition), displayOrDash(right.condition));
  push("inspection", "Inspection", displayOrDash(left.inspectionStatus), displayOrDash(right.inspectionStatus));
  push("delivery", "Delivery window", displayOrDash(left.estimatedDelivery), displayOrDash(right.estimatedDelivery));
  push("vin", "VIN / chassis", displayOrDash(left.vin ?? "Available on request"), displayOrDash(right.vin ?? "Available on request"));

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

  const specLabels = new Set<string>();
  for (const s of left.specs) specLabels.add(s.label.trim());
  for (const s of right.specs) specLabels.add(s.label.trim());

  const leftSpecMap = new Map(left.specs.map((s) => [s.label.trim(), s.value]));
  const rightSpecMap = new Map(right.specs.map((s) => [s.label.trim(), s.value]));

  for (const label of [...specLabels].sort((a, b) => a.localeCompare(b))) {
    push(`spec:${label}`, label, displayOrDash(leftSpecMap.get(label)), displayOrDash(rightSpecMap.get(label)));
  }

  const highlightKeys = new Set<string>();
  if (left.specifications && typeof left.specifications === "object" && !Array.isArray(left.specifications)) {
    for (const k of Object.keys(left.specifications as Record<string, string>)) highlightKeys.add(k);
  }
  if (right.specifications && typeof right.specifications === "object" && !Array.isArray(right.specifications)) {
    for (const k of Object.keys(right.specifications as Record<string, string>)) highlightKeys.add(k);
  }

  for (const key of [...highlightKeys].sort((a, b) => a.localeCompare(b))) {
    const lObj =
      left.specifications && typeof left.specifications === "object" && !Array.isArray(left.specifications)
        ? (left.specifications as Record<string, string>)
        : {};
    const rObj =
      right.specifications && typeof right.specifications === "object" && !Array.isArray(right.specifications)
        ? (right.specifications as Record<string, string>)
        : {};
    push(`highlight:${key}`, key, displayOrDash(lObj[key]), displayOrDash(rObj[key]));
  }

  return rows;
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
