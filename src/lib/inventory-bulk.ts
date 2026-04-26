/**
 * Shared CSV helpers + column contracts for bulk cars/parts import & export (Excel opens UTF-8 CSV).
 */

import type {
  AvailabilityStatus,
  CarListingState,
  EngineType,
  PartListingState,
  PartOrigin,
  PartStockStatus,
  SourceType,
} from "@prisma/client";

export const UTF8_BOM = "\uFEFF";

const AVAIL: AvailabilityStatus[] = ["AVAILABLE", "RESERVED", "SOLD", "COMING_SOON", "IN_TRANSIT_STOCK", "ON_REQUEST"];
const CAR_LISTING: CarListingState[] = ["DRAFT", "PUBLISHED", "HIDDEN", "SOLD"];
const ENGINE: EngineType[] = ["GASOLINE_PETROL", "GASOLINE_DIESEL", "ELECTRIC", "HYBRID", "PLUGIN_HYBRID"];
const SOURCE: SourceType[] = ["IN_GHANA", "IN_CHINA", "IN_TRANSIT"];
const PART_LISTING: PartListingState[] = ["DRAFT", "PUBLISHED", "HIDDEN"];
const PART_STOCK: PartStockStatus[] = ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "ON_REQUEST"];
const PART_ORIGIN: PartOrigin[] = ["GHANA", "CHINA"];

/** Header row order must match export/import round-trip. */
export const CAR_BULK_COLUMNS = [
  "id",
  "slug",
  "title",
  "brand",
  "model",
  "year",
  "trim",
  "engineType",
  "transmission",
  "sourceType",
  "availabilityStatus",
  "basePriceRmb",
  "price",
  "currency",
  "listingState",
  "featured",
  "mileage",
  "colorExterior",
  "location",
  "shortDescription",
  "seaShippingFeeGhs",
  "supplierCostRmb",
  "coverImageUrl",
] as const;

export const PART_BULK_COLUMNS = [
  "id",
  "slug",
  "title",
  "shortDescription",
  "description",
  "category",
  "origin",
  "basePriceRmb",
  "priceGhs",
  "stockQty",
  "stockStatus",
  "stockStatusLocked",
  "listingState",
  "sku",
  "featured",
  "supplierCostRmb",
  "coverImageUrl",
] as const;

export type CarBulkColumn = (typeof CAR_BULK_COLUMNS)[number];
export type PartBulkColumn = (typeof PART_BULK_COLUMNS)[number];

export function escapeCsvField(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return "";
  const s = typeof val === "boolean" ? (val ? "true" : "false") : String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsvLine(fields: string[]): string {
  return fields.map(escapeCsvField).join(",");
}

/** Parse CSV text into header + data rows (handles quoted fields with commas). */
export function parseCsvText(csv: string): { header: string[]; rows: string[][] } {
  const lines = splitCsvLines(csv.replace(/^\uFEFF/, "").trim());
  if (lines.length === 0) return { header: [], rows: [] };
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map(parseCsvLine);
  return { header, rows };
}

function splitCsvLines(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      cur += c;
    } else if ((c === "\n" || (c === "\r" && text[i + 1] === "\n")) && !inQuotes) {
      if (c === "\r") i++;
      const t = cur.trim();
      if (t) out.push(t);
      cur = "";
    } else {
      cur += c;
    }
  }
  const t = cur.trim();
  if (t) out.push(t);
  return out;
}

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

export function rowToRecord(header: string[], row: string[]): Record<string, string> {
  const o: Record<string, string> = {};
  for (let i = 0; i < header.length; i++) {
    const key = header[i]?.trim();
    if (!key) continue;
    o[key] = row[i] ?? "";
  }
  return o;
}

export function pickEnum<T extends string>(allowed: readonly T[], raw: string | undefined, fallback: T): T {
  const v = (raw ?? "").trim().toUpperCase() as T;
  return (allowed as readonly string[]).includes(v) ? v : fallback;
}

export function pickEngine(raw: string | undefined): EngineType {
  const u = (raw ?? "").trim().toUpperCase();
  if (u === "GASOLINE") return "GASOLINE_PETROL";
  return pickEnum(ENGINE, raw, "GASOLINE_PETROL");
}

export function pickSource(raw: string | undefined): SourceType {
  return pickEnum(SOURCE, raw, "IN_GHANA");
}

export function pickAvailability(raw: string | undefined): AvailabilityStatus {
  return pickEnum(AVAIL, raw, "AVAILABLE");
}

export function pickCarListing(raw: string | undefined): CarListingState {
  return pickEnum(CAR_LISTING, raw, "DRAFT");
}

export function pickPartListing(raw: string | undefined): PartListingState {
  return pickEnum(PART_LISTING, raw, "DRAFT");
}

export function pickPartStock(raw: string | undefined): PartStockStatus {
  return pickEnum(PART_STOCK, raw, "IN_STOCK");
}

export function pickPartOrigin(raw: string | undefined): PartOrigin {
  return pickEnum(PART_ORIGIN, raw, "GHANA");
}

export function parseBool(raw: string | undefined, fallback = false): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return fallback;
}

export function parseDecimal(raw: string | undefined): number | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function parseIntSafe(raw: string | undefined, fallback: number): number {
  const n = parseInt((raw ?? "").trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function slugifyBase(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}

export function uniqueSlug(base: string, suffix: string): string {
  const s = `${base}-${suffix}`.replace(/-+/g, "-").slice(0, 120);
  return s;
}

export type CarExportShape = {
  id: string;
  slug: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  trim: string | null;
  engineType: EngineType;
  transmission: string | null;
  sourceType: SourceType;
  availabilityStatus: AvailabilityStatus;
  basePriceRmb: unknown;
  price: unknown;
  currency: string;
  listingState: CarListingState;
  featured: boolean;
  mileage: number | null;
  colorExterior: string | null;
  location: string | null;
  shortDescription: string | null;
  seaShippingFeeGhs: unknown | null;
  supplierCostRmb: unknown | null;
  coverImageUrl: string | null;
};

export function carToCsvValues(c: CarExportShape): string[] {
  return [
    c.id,
    c.slug,
    c.title,
    c.brand,
    c.model,
    String(c.year),
    c.trim ?? "",
    c.engineType,
    c.transmission ?? "",
    c.sourceType,
    c.availabilityStatus,
    String(Number(c.basePriceRmb)),
    String(Number(c.price)),
    c.currency,
    c.listingState,
    c.featured ? "true" : "false",
    c.mileage != null ? String(c.mileage) : "",
    c.colorExterior ?? "",
    c.location ?? "",
    c.shortDescription ?? "",
    c.seaShippingFeeGhs != null ? String(Number(c.seaShippingFeeGhs)) : "",
    c.supplierCostRmb != null ? String(Number(c.supplierCostRmb)) : "",
    c.coverImageUrl ?? "",
  ];
}

export type PartExportShape = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  category: string;
  origin: PartOrigin;
  basePriceRmb: unknown;
  priceGhs: unknown;
  stockQty: number;
  stockStatus: PartStockStatus;
  stockStatusLocked: boolean;
  listingState: PartListingState;
  sku: string | null;
  featured: boolean;
  supplierCostRmb: unknown | null;
  coverImageUrl: string | null;
};

export function partToCsvValues(p: PartExportShape): string[] {
  return [
    p.id,
    p.slug,
    p.title,
    p.shortDescription ?? "",
    p.description ?? "",
    p.category,
    p.origin,
    String(Number(p.basePriceRmb)),
    String(Number(p.priceGhs)),
    String(p.stockQty),
    p.stockStatus,
    p.stockStatusLocked ? "true" : "false",
    p.listingState,
    p.sku ?? "",
    p.featured ? "true" : "false",
    p.supplierCostRmb != null ? String(Number(p.supplierCostRmb)) : "",
    p.coverImageUrl ?? "",
  ];
}

export function carsToCsv(cars: CarExportShape[]): string {
  const lines = [buildCsvLine([...CAR_BULK_COLUMNS]), ...cars.map((c) => buildCsvLine(carToCsvValues(c)))];
  return UTF8_BOM + lines.join("\n");
}

export function partsToCsv(parts: PartExportShape[]): string {
  const lines = [buildCsvLine([...PART_BULK_COLUMNS]), ...parts.map((p) => buildCsvLine(partToCsvValues(p)))];
  return UTF8_BOM + lines.join("\n");
}
