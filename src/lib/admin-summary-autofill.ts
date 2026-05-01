import {
  AvailabilityStatus,
  CarListingState,
  EngineType,
  PartOrigin,
  SourceType,
} from "@prisma/client";

import type { FxRatesInput } from "@/lib/currency";

/** How the parser obtained a value — explicit lines are safer to apply over user edits. */
export type AutofillConfidence = "explicit" | "heuristic";

export type AutofillStringField = {
  value: string;
  confidence: AutofillConfidence;
};

export type AutofillNumberField = {
  value: number;
  confidence: AutofillConfidence;
};

export type AutofillPriceField = {
  amount: number;
  currency: "GHS" | "CNY" | "RMB" | "USD";
  confidence: AutofillConfidence;
};

export type AutofillCheckboxField = {
  value: boolean;
  confidence: AutofillConfidence;
};

/** Canonical RMB for vehicle list price (form field `basePriceRmb`). */
export type CarSummaryAutofillResult = {
  stringFields: Partial<Record<string, AutofillStringField>>;
  numberFields: Partial<Record<string, AutofillNumberField>>;
  /** When set, maps to `engineType` select value. */
  engineTypeEnum?: { value: EngineType; confidence: AutofillConfidence };
  sourceTypeEnum?: { value: SourceType; confidence: AutofillConfidence };
  availabilityEnum?: { value: AvailabilityStatus; confidence: AutofillConfidence };
  listingStateEnum?: { value: CarListingState; confidence: AutofillConfidence };
  basePriceRmb?: AutofillNumberField;
  /** Raw price in another currency — convert in UI using admin rates. */
  listPriceAlternate?: AutofillPriceField;
  featured?: AutofillCheckboxField;
  /** Spec concepts we do not map to a form `name` (document for admins). */
  unmappedConcepts: string[];
};

export type PartSummaryAutofillResult = {
  stringFields: Partial<Record<string, AutofillStringField>>;
  numberFields: Partial<Record<string, AutofillNumberField>>;
  originEnum?: { value: PartOrigin; confidence: AutofillConfidence };
  basePriceGhs?: AutofillNumberField;
  basePriceRmb?: AutofillNumberField;
  featured?: AutofillCheckboxField;
  stockStatusLocked?: AutofillCheckboxField;
  unmappedConcepts: string[];
};

export function normalizeAutofillKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_\-]+/g, "")
    .replace(/[^a-z0-9%]/g, "");
}

/** RMB (canonical) from a GHS list price using admin divisor: RMB = GHS × rmbToGhs. */
export function ghsAmountToCanonicalRmb(ghs: number, rates: FxRatesInput): number {
  const d = Number(rates.rmbToGhs);
  if (!Number.isFinite(d) || d <= 0) return 0;
  return ghs * d;
}

export function shouldApplyAutofillText(
  current: string,
  initial: string,
  proposed: AutofillStringField,
): boolean {
  const c = current.trim();
  const i = initial.trim();
  const p = proposed.value.trim();
  if (!p) return false;
  if (!c) return true;
  if (c === i) return true;
  if (proposed.confidence === "heuristic") return false;
  if (proposed.confidence === "explicit" && p.length >= c.length + 20 && p.length >= Math.ceil(c.length * 1.4)) {
    return true;
  }
  return false;
}

export function shouldApplyAutofillNumber(
  currentStr: string,
  initialStr: string,
  proposed: AutofillNumberField,
): boolean {
  const cur = parseFloat(currentStr.replace(/,/g, ""));
  const ini = parseFloat(initialStr.replace(/,/g, ""));
  const p = proposed.value;
  if (!Number.isFinite(p)) return false;
  if (!Number.isFinite(cur) || cur === 0) return true;
  if (Number.isFinite(ini) && cur === ini) return true;
  if (proposed.confidence === "heuristic") return false;
  return false;
}

export function shouldApplyAutofillCheckbox(
  currentChecked: boolean,
  initialChecked: boolean,
  proposed: AutofillCheckboxField | undefined,
): boolean {
  if (!proposed) return false;
  if (currentChecked === initialChecked) return true;
  return proposed.confidence === "explicit";
}

/** Select / enum values: explicit labeled lines may override a user-changed select; heuristics may not. */
export function shouldApplyAutofillEnum(
  current: string,
  initial: string,
  proposed: { value: string; confidence: AutofillConfidence },
): boolean {
  const c = current.trim();
  const i = initial.trim();
  const p = proposed.value.trim();
  if (!p) return false;
  if (!c || c === i) return true;
  if (proposed.confidence === "heuristic") return false;
  return true;
}

export function usdAmountToCanonicalRmb(usd: number, rates: FxRatesInput): number {
  const m = Number(rates.usdToRmb);
  if (!Number.isFinite(m) || m <= 0) return 0;
  return usd * m;
}

function setField(
  m: Partial<Record<string, AutofillStringField>>,
  key: string,
  value: string,
  confidence: AutofillConfidence,
  override = false,
) {
  const v = value.trim();
  if (!v) return;
  if (!override && m[key]) return;
  m[key] = { value: v, confidence };
}

function setNum(
  m: Partial<Record<string, AutofillNumberField>>,
  key: string,
  value: number,
  confidence: AutofillConfidence,
  override = false,
) {
  if (!Number.isFinite(value)) return;
  if (!override && m[key]) return;
  m[key] = { value, confidence };
}

/** Maps normalized label → form `name` for car create/edit. */
const CAR_LINE_FIELD: Record<string, string> = {
  title: "title",
  name: "title",
  headline: "title",
  make: "brand",
  brand: "brand",
  manufacturer: "brand",
  model: "model",
  year: "year",
  yr: "year",
  trim: "trim",
  body: "bodyType",
  bodytype: "bodyType",
  type: "bodyType",
  condition: "condition",
  mileage: "mileage",
  km: "mileage",
  odometer: "mileage",
  transmission: "transmission",
  trans: "transmission",
  gearbox: "transmission",
  drivetrain: "drivetrain",
  drive: "drivetrain",
  color: "colorExterior",
  colour: "colorExterior",
  exterior: "colorExterior",
  exteriorcolor: "colorExterior",
  interior: "colorInterior",
  interiorcolor: "colorInterior",
  vin: "vin",
  chassis: "vin",
  location: "location",
  place: "location",
  summary: "shortDescription",
  short: "shortDescription",
  shortdescription: "shortDescription",
  description: "longDescription",
  long: "longDescription",
  longdescription: "longDescription",
  details: "longDescription",
  notes: "longDescription",
  tags: "tags",
  badges: "tags",
  features: "tags",
  enginedetails: "engineDetails",
  technical: "engineDetails",
  inspection: "inspectionStatus",
  inspectionstatus: "inspectionStatus",
  delivery: "estimatedDelivery",
  estimateddelivery: "estimatedDelivery",
  accident: "accidentHistory",
  accidenthistory: "accidentHistory",
  seafreight: "seaShippingFeeGhs",
  seashipping: "seaShippingFeeGhs",
  shippingghs: "seaShippingFeeGhs",
  dealer: "supplierDealerName",
  suppliername: "supplierDealerName",
  supplierdealername: "supplierDealerName",
  dealerphone: "supplierDealerPhone",
  supplierdealerphone: "supplierDealerPhone",
  dealerref: "supplierDealerReference",
  supplierdealerreference: "supplierDealerReference",
  cover: "coverImageUrl",
  image: "coverImageUrl",
  coverurl: "coverImageUrl",
  coverimageurl: "coverImageUrl",
  publicid: "coverImagePublicId",
  coverimagepublicid: "coverImagePublicId",
  cloudinary: "coverImagePublicId",
  specifications: "specifications",
  specs: "specifications",
  json: "specifications",
  supplierdealernotes: "supplierDealerNotes",
  dealernotes: "supplierDealerNotes",
  tracenotes: "supplierDealerNotes",
  listingnotes: "supplierDealerNotes",
};

function resolveEngineType(val: string): EngineType | undefined {
  const n = normalizeAutofillKey(val);
  if (n.includes("diesel")) return EngineType.GASOLINE_DIESEL;
  if (n.includes("plugin") || n.includes("phev")) return EngineType.PLUGIN_HYBRID;
  if (n.includes("hybrid")) return EngineType.HYBRID;
  if (n.includes("electric") || n === "ev" || n.includes("bev")) return EngineType.ELECTRIC;
  if (n.includes("petrol") || n.includes("gasoline") || n.includes("gas") || n === "ice")
    return EngineType.GASOLINE_PETROL;
  const u = val.trim().toUpperCase().replace(/\s+/g, "_");
  if (u in EngineType) return u as EngineType;
  return undefined;
}

function resolveSourceType(val: string): SourceType | undefined {
  const u = val.trim().toUpperCase().replace(/\s+/g, "_");
  if ((Object.values(SourceType) as string[]).includes(u)) return u as SourceType;
  const n = normalizeAutofillKey(val);
  if (n.includes("ghana")) return SourceType.IN_GHANA;
  if (n.includes("china")) return SourceType.IN_CHINA;
  if (n.includes("transit")) return SourceType.IN_TRANSIT;
  return undefined;
}

function resolveAvailability(val: string): AvailabilityStatus | undefined {
  const u = val.trim().toUpperCase().replace(/\s+/g, "_");
  if ((Object.values(AvailabilityStatus) as string[]).includes(u)) return u as AvailabilityStatus;
  const n = normalizeAutofillKey(val);
  if (n.includes("available")) return AvailabilityStatus.AVAILABLE;
  if (n.includes("reserved")) return AvailabilityStatus.RESERVED;
  if (n.includes("sold")) return AvailabilityStatus.SOLD;
  if (n.includes("coming")) return AvailabilityStatus.COMING_SOON;
  if (n.includes("request")) return AvailabilityStatus.ON_REQUEST;
  return undefined;
}

function resolveListingState(val: string): CarListingState | undefined {
  const u = val.trim().toUpperCase().replace(/\s+/g, "_");
  if ((Object.values(CarListingState) as string[]).includes(u)) return u as CarListingState;
  const n = normalizeAutofillKey(val);
  if (n.includes("draft")) return CarListingState.DRAFT;
  if (n.includes("publish")) return CarListingState.PUBLISHED;
  if (n.includes("hidden")) return CarListingState.HIDDEN;
  return undefined;
}

function parseMoneySegment(segment: string): AutofillPriceField | null {
  const s = segment.trim();
  const ghs =
    /(?:GHS|₵|CEDIS?)\s*:?\s*([\d,]+(?:\.\d+)?)/i.exec(s) ||
    /([\d,]+(?:\.\d+)?)\s*(?:GHS|CEDIS?)/i.exec(s) ||
    /(?:price|asking)[^0-9]{0,12}(?:GHS|₵|CEDIS?)\s*:?\s*([\d,]+(?:\.\d+)?)/i.exec(s);
  if (ghs) {
    const n = parseFloat(ghs[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) return { amount: n, currency: "GHS", confidence: "heuristic" };
  }
  const rmb =
    /(?:RMB|CNY|¥)\s*:?\s*([\d,]+(?:\.\d+)?)/i.exec(s) || /([\d,]+(?:\.\d+)?)\s*(?:RMB|CNY)/i.exec(s);
  if (rmb) {
    const n = parseFloat(rmb[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) return { amount: n, currency: "RMB", confidence: "heuristic" };
  }
  const usd = /\$\s*:?\s*([\d,]+(?:\.\d+)?)/i.exec(s) || /([\d,]+(?:\.\d+)?)\s*USD/i.exec(s);
  if (usd) {
    const n = parseFloat(usd[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) return { amount: n, currency: "USD", confidence: "heuristic" };
  }
  return null;
}

function extractVin(text: string): string | null {
  const m = /\b([A-HJ-NPR-Z0-9]{17})\b/i.exec(text.replace(/\s/g, ""));
  return m ? m[1].toUpperCase() : null;
}

function extractYear(text: string): number | null {
  const m = /\b(19[89]\d|20[0-3]\d)\b/.exec(text);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  if (y < 1980 || y > 2035) return null;
  return y;
}

function extractMileageKm(text: string): number | null {
  const m = /([\d,]+)\s*(?:,|\s)?\s*km\b/i.exec(text);
  if (!m) return null;
  const n = parseInt(m[1].replace(/,/g, ""), 10);
  return Number.isFinite(n) && n >= 0 && n < 2_000_000 ? n : null;
}

function parseBrandModelYear(
  segment: string,
): { brand: string; model: string; year: number } | null {
  const t = segment.trim();
  const m = /^([A-Za-z][A-Za-z-]{1,30})\s+([A-Za-z0-9][A-Za-z0-9-]{0,40})\s+(19[89]\d|20[0-3]\d)$/.exec(t);
  if (!m) return null;
  const year = parseInt(m[3], 10);
  return { brand: m[1], model: m[2], year };
}

/**
 * Deterministic parse: labeled lines first, then conservative heuristics on comma-separated / free text.
 */
export function parseCarSummaryForAutofill(raw: string): CarSummaryAutofillResult {
  const stringFields: Partial<Record<string, AutofillStringField>> = {};
  const numberFields: Partial<Record<string, AutofillNumberField>> = {};
  const unmappedConcepts: string[] = [];
  let engineTypeEnum: CarSummaryAutofillResult["engineTypeEnum"];
  let sourceTypeEnum: CarSummaryAutofillResult["sourceTypeEnum"];
  let availabilityEnum: CarSummaryAutofillResult["availabilityEnum"];
  let listingStateEnum: CarSummaryAutofillResult["listingStateEnum"];
  let basePriceRmb: AutofillNumberField | undefined;
  let listPriceAlternate: AutofillPriceField | undefined;
  let featured: AutofillCheckboxField | undefined;

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const leftover: string[] = [];

  for (const line of lines) {
    const labeled = /^([^:=]{1,64}?)\s*[:=]\s*(.+)$/.exec(line);
    if (labeled) {
      const alias = normalizeAutofillKey(labeled[1]);
      const value = labeled[2].trim();
      if (alias === "price" || alias === "listprice" || alias === "asking") {
        const p = parseMoneySegment(value) ?? parseMoneySegment(`${value} `);
        if (p) {
          if (p.currency === "RMB" || p.currency === "CNY") {
            basePriceRmb = { value: p.amount, confidence: "explicit" };
          } else {
            listPriceAlternate = { ...p, confidence: "explicit" };
          }
        }
        continue;
      }
      if (
        alias === "suppliercost" ||
        alias === "suppliercostrmb" ||
        alias === "costrmb" ||
        alias === "dealercost" ||
        alias === "cost"
      ) {
        const n = parseFloat(value.replace(/,/g, ""));
        if (Number.isFinite(n) && n > 0) setNum(numberFields, "supplierCostRmb", n, "explicit");
        continue;
      }
      if (alias === "featured" || alias === "spotlight") {
        const on = /^(1|yes|true|on|y)$/i.test(value);
        featured = { value: on, confidence: "explicit" };
        continue;
      }
      if (alias === "enginetype") {
        const e = resolveEngineType(value);
        if (e) engineTypeEnum = { value: e, confidence: "explicit" };
        continue;
      }
      if (alias === "source" || alias === "sourcetype") {
        const s = resolveSourceType(value);
        if (s) sourceTypeEnum = { value: s, confidence: "explicit" };
        continue;
      }
      if (alias === "availability" || alias === "stock") {
        const s = resolveAvailability(value);
        if (s) availabilityEnum = { value: s, confidence: "explicit" };
        continue;
      }
      if (alias === "listing" || alias === "listingstate" || alias === "visibility") {
        const s = resolveListingState(value);
        if (s) listingStateEnum = { value: s, confidence: "explicit" };
        continue;
      }
      if (alias === "engine" || alias === "motor") {
        const e = resolveEngineType(value);
        if (e) engineTypeEnum = { value: e, confidence: "explicit" };
        else setField(stringFields, "engineDetails", value, "explicit", true);
        continue;
      }
      if (alias === "fuel" || alias === "fueltype") {
        const e = resolveEngineType(value);
        if (e) engineTypeEnum = { value: e, confidence: "explicit" };
        continue;
      }
      const formName = CAR_LINE_FIELD[alias];
      if (formName) {
        setField(stringFields, formName, value, "explicit", formName === "engineDetails");
        continue;
      }
      unmappedConcepts.push(labeled[1].trim());
    } else {
      leftover.push(line);
    }
  }

  const blob = leftover.join("\n").trim() || raw.trim();
  if (blob) {
    for (const segment of blob.split(",").map((s) => s.trim()).filter(Boolean)) {
      const low = segment.toLowerCase();
      if (/price|ghs|rmb|cedis|¥|\$|asking/i.test(segment)) {
        const p = parseMoneySegment(segment);
        if (p && !basePriceRmb && !listPriceAlternate) {
          if (p.currency === "RMB" || p.currency === "CNY") basePriceRmb = { value: p.amount, confidence: "heuristic" };
          else listPriceAlternate = p;
        }
        continue;
      }
      if (/\bkm\b/i.test(segment)) {
        const km = extractMileageKm(segment + " ");
        if (km != null) setNum(numberFields, "mileage", km, "heuristic");
        continue;
      }
      if (/\d+(?:\.\d+)?\s*L\b/i.test(segment)) {
        const cur = stringFields.engineDetails?.value ?? "";
        const add = segment.trim();
        const next = cur ? `${cur}; ${add}` : add;
        setField(stringFields, "engineDetails", next, "heuristic", true);
        continue;
      }
      if (/\b(automatic|auto|manual|cvt|dct)\b/i.test(low)) {
        const t = /\bautomatic|auto\b/i.test(low)
          ? "Automatic"
          : /\bmanual\b/i.test(low)
            ? "Manual"
            : /\bcvt\b/i.test(low)
              ? "CVT"
              : /\bdct\b/i.test(low)
                ? "DCT"
                : segment;
        setField(stringFields, "transmission", t, "heuristic");
        continue;
      }
      const bmy = parseBrandModelYear(segment);
      if (bmy) {
        setField(stringFields, "brand", bmy.brand, "heuristic");
        setField(stringFields, "model", bmy.model, "heuristic");
        setNum(numberFields, "year", bmy.year, "heuristic");
        continue;
      }
      const simpleColors =
        /^(white|black|silver|grey|gray|red|blue|green|brown|beige|gold|orange|yellow|purple)$/i.exec(segment);
      if (simpleColors) {
        setField(stringFields, "colorExterior", simpleColors[1], "heuristic");
        continue;
      }
    }

    const vin = extractVin(blob);
    if (vin && !stringFields.vin) setField(stringFields, "vin", vin, "heuristic");

    const yr = extractYear(blob);
    if (yr != null && !numberFields.year) setNum(numberFields, "year", yr, "heuristic");

    const km = extractMileageKm(blob);
    if (km != null && !numberFields.mileage) setNum(numberFields, "mileage", km, "heuristic");

    const eng = resolveEngineType(blob);
    if (eng && !engineTypeEnum) engineTypeEnum = { value: eng, confidence: "heuristic" };

    if (!stringFields.title && blob.split("\n").length === 1 && blob.length <= 120 && !extractVin(blob)) {
      setField(stringFields, "title", blob, "heuristic");
    } else if (!stringFields.shortDescription && blob.length > 0) {
      setField(stringFields, "shortDescription", blob.slice(0, 500), "heuristic");
    }
  }

  if (!basePriceRmb && listPriceAlternate && (listPriceAlternate.currency === "RMB" || listPriceAlternate.currency === "CNY")) {
    basePriceRmb = { value: listPriceAlternate.amount, confidence: listPriceAlternate.confidence };
    listPriceAlternate = undefined;
  }

  return {
    stringFields,
    numberFields,
    engineTypeEnum,
    sourceTypeEnum,
    availabilityEnum,
    listingStateEnum,
    basePriceRmb,
    listPriceAlternate,
    featured,
    unmappedConcepts,
  };
}

const PART_LINE_FIELD: Record<string, keyof PartSummaryAutofillResult["stringFields"]> = {
  title: "title",
  name: "title",
  product: "title",
  category: "category",
  cat: "category",
  sku: "sku",
  partnumber: "sku",
  oem: "sku",
  partno: "sku",
  number: "sku",
  summary: "shortDescription",
  short: "shortDescription",
  description: "description",
  long: "description",
  details: "description",
  tags: "tags",
  supplierphone: "supplierDistributorPhone",
  phone: "supplierDistributorPhone",
  supplierref: "supplierDistributorRef",
  reference: "supplierDistributorRef",
  distributor: "supplierDistributorRef",
  colors: "optionColors",
  colour: "optionColors",
  optioncolors: "optionColors",
  sizes: "optionSizes",
  optionsizes: "optionSizes",
};

function resolvePartOrigin(val: string): PartOrigin | undefined {
  const n = normalizeAutofillKey(val);
  if (n.includes("china") || n.includes("rmb") || n.includes("preorder")) return PartOrigin.CHINA;
  if (n.includes("ghana") || n.includes("local") || n.includes("ghs")) return PartOrigin.GHANA;
  return undefined;
}

/**
 * Part schema has no dedicated brand / condition / location — those alias into tags or description.
 */
export function parsePartSummaryForAutofill(raw: string): PartSummaryAutofillResult {
  const stringFields: Partial<Record<string, AutofillStringField>> = {};
  const numberFields: Partial<Record<string, AutofillNumberField>> = {};
  let originEnum: PartSummaryAutofillResult["originEnum"];
  let basePriceGhs: AutofillNumberField | undefined;
  let basePriceRmb: AutofillNumberField | undefined;
  let featured: AutofillCheckboxField | undefined;
  let stockStatusLocked: AutofillCheckboxField | undefined;
  const unmappedConcepts: string[] = [];

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const loose: string[] = [];
  let fitsNote = "";

  for (const line of lines) {
    const labeled = /^([^:=]{1,64}?)\s*[:=]\s*(.+)$/.exec(line);
    if (!labeled) {
      loose.push(line);
      continue;
    }
    const alias = normalizeAutofillKey(labeled[1]);
    const value = labeled[2].trim();
    if (alias === "origin" || alias === "lane") {
      const o = resolvePartOrigin(value);
      if (o) originEnum = { value: o, confidence: "explicit" };
      continue;
    }
    if (alias === "price" || alias === "listprice") {
      const p = parseMoneySegment(value) ?? parseMoneySegment(`${value} `);
      if (p) {
        if (p.currency === "GHS") basePriceGhs = { value: p.amount, confidence: "explicit" };
        else if (p.currency === "RMB" || p.currency === "CNY") basePriceRmb = { value: p.amount, confidence: "explicit" };
        else if (p.currency === "USD") {
          unmappedConcepts.push("price in USD (use GHS or RMB for part list price, or set price after autofill)");
        }
      }
      continue;
    }
    if (
      alias === "suppliercost" ||
      alias === "suppliercostrmb" ||
      alias === "costrmb" ||
      alias === "dealercost" ||
      alias === "cost"
    ) {
      const n = parseFloat(value.replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0) setNum(numberFields, "supplierCostRmb", n, "explicit");
      continue;
    }
    if (alias === "priceghs" || alias === "ghs" || alias === "cedis") {
      const n = parseFloat(value.replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0) basePriceGhs = { value: n, confidence: "explicit" };
      continue;
    }
    if (alias === "pricermb" || alias === "rmb" || alias === "cny") {
      const n = parseFloat(value.replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0) basePriceRmb = { value: n, confidence: "explicit" };
      continue;
    }
    if (alias === "stock" || alias === "qty" || alias === "quantity") {
      const n = parseInt(value.replace(/,/g, ""), 10);
      if (Number.isFinite(n) && n >= 0) setNum(numberFields, "stockQty", n, "explicit");
      continue;
    }
    if (alias === "featured") {
      featured = { value: /^(1|yes|true|on|y)$/i.test(value), confidence: "explicit" };
      continue;
    }
    if (alias === "lockstock" || alias === "stockstatuslocked") {
      stockStatusLocked = { value: /^(1|yes|true|on|y)$/i.test(value), confidence: "explicit" };
      continue;
    }
    if (alias === "fits" || alias === "compatible" || alias === "vehicle" || alias === "for") {
      fitsNote = fitsNote ? `${fitsNote}; ${value}` : value;
      continue;
    }
    if (alias === "brand") {
      const tag = `Brand: ${value}`;
      const cur = stringFields.tags?.value ?? "";
      setField(stringFields, "tags", cur ? `${cur}, ${tag}` : tag, "explicit", true);
      continue;
    }
    if (alias === "condition" || alias === "location") {
      const label = alias === "condition" ? "Condition" : "Location";
      const line = `${label} (from summary): ${value}`;
      const cur = stringFields.description?.value ?? "";
      setField(stringFields, "description", cur ? `${cur}\n\n${line}` : line, "explicit", true);
      unmappedConcepts.push(`${alias} (no dedicated Part column — appended to description)`);
      continue;
    }
    const target = PART_LINE_FIELD[alias];
    if (target) {
      setField(stringFields, target, value, "explicit", target === "description" || target === "tags");
      continue;
    }
    unmappedConcepts.push(labeled[1].trim());
  }

  const blob = loose.join("\n").trim();
  if (blob) {
    for (const segment of blob.split(",").map((s) => s.trim()).filter(Boolean)) {
      const p = parseMoneySegment(segment);
      if (p) {
        if (p.currency === "GHS" && !basePriceGhs) basePriceGhs = { value: p.amount, confidence: "heuristic" };
        else if ((p.currency === "RMB" || p.currency === "CNY") && !basePriceRmb) basePriceRmb = { value: p.amount, confidence: "heuristic" };
        continue;
      }
      const q = /^(?:qty|stock|quantity)\s*:?\s*(\d+)/i.exec(segment);
      if (q) {
        const n = parseInt(q[1], 10);
        if (Number.isFinite(n)) setNum(numberFields, "stockQty", n, "heuristic");
      }
    }
    if (!stringFields.title && blob.length <= 120 && !blob.includes("\n")) {
      setField(stringFields, "title", blob, "heuristic");
    } else if (!stringFields.shortDescription) {
      setField(stringFields, "shortDescription", blob.slice(0, 500), "heuristic");
    }
  }

  if (fitsNote) {
    const fitLine = `Compatibility / vehicle: ${fitsNote}`;
    const desc = stringFields.description?.value ?? "";
    setField(stringFields, "description", desc ? `${desc}\n\n${fitLine}` : fitLine, "explicit", true);
  }

  return {
    stringFields,
    numberFields,
    originEnum,
    basePriceGhs,
    basePriceRmb,
    featured,
    stockStatusLocked,
    unmappedConcepts,
  };
}

export function getFormControlString(form: HTMLFormElement, name: string): string {
  const el = form.elements.namedItem(name);
  if (!el) return "";
  if (el instanceof RadioNodeList) {
    const r = Array.from(el).find((x) => x instanceof HTMLInputElement && x.type === "radio" && x.checked);
    return r instanceof HTMLInputElement ? r.value : "";
  }
  if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox") return el.checked ? "on" : "";
    return el.value;
  }
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return el.value;
  return "";
}

export function getFormCheckboxChecked(form: HTMLFormElement, name: string): boolean {
  const el = form.elements.namedItem(name);
  if (el instanceof HTMLInputElement && el.type === "checkbox") return el.checked;
  return false;
}

export function setFormControlString(form: HTMLFormElement, name: string, value: string): void {
  const el = form.elements.namedItem(name);
  if (!el) return;
  if (el instanceof RadioNodeList) return;
  if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox") {
      el.checked = value === "on" || value === "true" || value === "1";
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

export const AUTOFILL_TOAST_REVIEW = "Fields updated from summary. Please review before saving.";
