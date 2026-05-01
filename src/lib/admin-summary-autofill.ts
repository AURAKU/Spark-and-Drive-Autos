import {
  AvailabilityStatus,
  CarListingState,
  EngineType,
  PartOrigin,
  SourceType,
} from "@prisma/client";

import type { FxRatesInput } from "@/lib/currency";
import type { AdminPriceCurrency } from "@/lib/paste-summary/core";
import {
  clipTrailingClause,
  findBestMoneyInText,
  normalizePasteLabel,
  parseMoneyWithCurrency,
  parsePlainAmount,
  stripWeakTrailingPunctuation,
  tryParseLabelThenMoney,
  tryParseLabelValueLine,
  tryParseSpaceSeparatedLabelLine,
} from "@/lib/paste-summary/core";

/** How the parser obtained a value — explicit lines are safer to apply over user edits. */
export type AutofillConfidence = "explicit" | "heuristic";

export type AutofillPreviewRow = { field: string; value: string; confidence?: AutofillConfidence };

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

export type ListingPriceAutofill = {
  amount: number;
  currency: AdminPriceCurrency;
  confidence: AutofillConfidence;
};

/** Parsed vehicle summary — apply `listingPrice` + `supplierCost` to `basePriceAmount` / `supplierCostAmount` + currency selects. */
export type CarSummaryAutofillResult = {
  stringFields: Partial<Record<string, AutofillStringField>>;
  numberFields: Partial<Record<string, AutofillNumberField>>;
  /** When set, maps to `engineType` select value. */
  engineTypeEnum?: { value: EngineType; confidence: AutofillConfidence };
  sourceTypeEnum?: { value: SourceType; confidence: AutofillConfidence };
  availabilityEnum?: { value: AvailabilityStatus; confidence: AutofillConfidence };
  listingStateEnum?: { value: CarListingState; confidence: AutofillConfidence };
  /** Primary list / selling price from paste (any supported currency). */
  listingPrice?: ListingPriceAutofill;
  /** Supplier / dealership cost with currency. */
  supplierCost?: ListingPriceAutofill;
  /** @deprecated Use `listingPrice` (CNY-only legacy consumers). */
  basePriceRmb?: AutofillNumberField;
  /** @deprecated Use `listingPrice`. */
  listPriceAlternate?: AutofillPriceField;
  featured?: AutofillCheckboxField;
  unmappedConcepts: string[];
};

export type PartSummaryAutofillResult = {
  stringFields: Partial<Record<string, AutofillStringField>>;
  numberFields: Partial<Record<string, AutofillNumberField>>;
  originEnum?: { value: PartOrigin; confidence: AutofillConfidence };
  /** Strongest detected list price (GHS / CNY / USD). */
  listPrice?: ListingPriceAutofill;
  supplierCost?: ListingPriceAutofill;
  featured?: AutofillCheckboxField;
  stockStatusLocked?: AutofillCheckboxField;
  unmappedConcepts: string[];
};

export function normalizeAutofillKey(raw: string): string {
  return normalizePasteLabel(raw);
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
  forceOverwrite = false,
): boolean {
  const p = proposed.value.trim();
  if (!p) return false;
  if (forceOverwrite) return true;
  const c = current.trim();
  const i = initial.trim();
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
  forceOverwrite = false,
): boolean {
  const p = proposed.value;
  if (!Number.isFinite(p)) return false;
  if (forceOverwrite) return true;
  const cur = parseFloat(currentStr.replace(/,/g, ""));
  const ini = parseFloat(initialStr.replace(/,/g, ""));
  if (!Number.isFinite(cur) || cur === 0) return true;
  if (Number.isFinite(ini) && cur === ini) return true;
  if (proposed.confidence === "heuristic") return false;
  return false;
}

export function shouldApplyAutofillCheckbox(
  currentChecked: boolean,
  initialChecked: boolean,
  proposed: AutofillCheckboxField | undefined,
  forceOverwrite = false,
): boolean {
  if (!proposed) return false;
  if (forceOverwrite) return true;
  if (currentChecked === initialChecked) return true;
  return proposed.confidence === "explicit";
}

/** Select / enum values: explicit labeled lines may override a user-changed select; heuristics may not. */
export function shouldApplyAutofillEnum(
  current: string,
  initial: string,
  proposed: { value: string; confidence: AutofillConfidence },
  forceOverwrite = false,
): boolean {
  const p = proposed.value.trim();
  if (!p) return false;
  if (forceOverwrite) return true;
  const c = current.trim();
  const i = initial.trim();
  if (!c || c === i) return true;
  if (proposed.confidence === "heuristic") return false;
  return true;
}

export function shouldApplyListingPrice(
  currentAmountStr: string,
  initialAmountStr: string,
  proposed: ListingPriceAutofill | undefined,
  forceOverwrite = false,
): boolean {
  if (!proposed || !Number.isFinite(proposed.amount)) return false;
  if (forceOverwrite) return true;
  return shouldApplyAutofillNumber(currentAmountStr, initialAmountStr, {
    value: proposed.amount,
    confidence: proposed.confidence,
  });
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
  odo: "mileage",
  enginesize: "engineDetails",
  engines: "engineDetails",
  displacement: "engineDetails",
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
  listingname: "title",
  listingtitle: "title",
  chassisnumber: "vin",
  vinnumber: "vin",
};

const CAR_LISTING_PRICE_LABELS = new Set(
  [
    "price",
    "listprice",
    "asking",
    "sellingprice",
    "sellprice",
    "retail",
    "basesellingprice",
    "basesaleprice",
    "basesellprice",
    "baseprice",
    "saleprice",
    "retailprice",
    "list",
    "msrp",
    "tag",
  ].map((k) => normalizePasteLabel(k)),
);

const CAR_SUPPLIER_COST_LABELS = new Set(
  [
    "suppliercost",
    "supplier",
    "dealercost",
    "dealershipcost",
    "dealership",
    "buyingcost",
    "buycost",
    "costprice",
    "landedcost",
    "invoicecost",
  ].map((k) => normalizePasteLabel(k)),
);

/** Normalized labels allowed as leading words: `title Foo`, `supplier cost CNY 5000`. */
const CAR_SPACE_LABEL_KEYS: Set<string> = (() => {
  const s = new Set<string>();
  for (const k of Object.keys(CAR_LINE_FIELD)) s.add(k);
  CAR_LISTING_PRICE_LABELS.forEach((x) => s.add(x));
  CAR_SUPPLIER_COST_LABELS.forEach((x) => s.add(x));
  for (const extra of [
    "basesellingprice",
    "basesaleprice",
    "baseprice",
    "saleprice",
    "askingprice",
    "sellingprice",
    "suppliercost",
    "dealershipcost",
    "dealercost",
    "buyingcost",
    "fuel",
    "fueltype",
    "enginetype",
    "listingstate",
    "availability",
    "stock",
    "source",
    "sourcetype",
    "featured",
    "spotlight",
    "chassisnumber",
    "vinnumber",
    "enginesize",
    "modelyear",
    "yr",
    "mileage",
    "odometer",
    "odo",
  ]) {
    s.add(extra);
  }
  return s;
})();

function mergeListingPrice(
  prev: ListingPriceAutofill | undefined,
  next: ListingPriceAutofill,
): ListingPriceAutofill {
  if (!prev) return next;
  if (next.confidence === "explicit" && prev.confidence === "heuristic") return next;
  if (prev.confidence === "explicit" && next.confidence === "heuristic") return prev;
  return next;
}

function parseMoneySegment(segment: string): AutofillPriceField | null {
  const p = parseMoneyWithCurrency(segment);
  if (!p) return null;
  return {
    amount: p.amount,
    currency: p.currency === "CNY" ? "CNY" : p.currency,
    confidence: "heuristic",
  };
}

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

function extractVin(text: string): string | null {
  const m = /\b([A-HJ-NPR-Z0-9]{17})\b/i.exec(text.replace(/\s/g, ""));
  return m ? m[1].toUpperCase() : null;
}

function extractYear(text: string): number | null {
  const m = /\b(19[89]\d|20[0-4]\d)\b/.exec(text);
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
  const m = /^([A-Za-z][A-Za-z-]{1,30})\s+([A-Za-z0-9][A-Za-z0-9-]{0,40})\s+(19[89]\d|20[0-4]\d)$/.exec(t);
  if (!m) return null;
  const year = parseInt(m[3], 10);
  return { brand: m[1], model: m[2], year };
}

/**
 * Deterministic parse: labeled lines first (incl. `Title - value` and `price GHS 95000`),
 * then conservative heuristics on comma-separated / free text.
 */
export function parseCarSummaryForAutofill(raw: string): CarSummaryAutofillResult {
  const stringFields: Partial<Record<string, AutofillStringField>> = {};
  const numberFields: Partial<Record<string, AutofillNumberField>> = {};
  const unmappedConcepts: string[] = [];
  let engineTypeEnum: CarSummaryAutofillResult["engineTypeEnum"];
  let sourceTypeEnum: CarSummaryAutofillResult["sourceTypeEnum"];
  let availabilityEnum: CarSummaryAutofillResult["availabilityEnum"];
  let listingStateEnum: CarSummaryAutofillResult["listingStateEnum"];
  let listingPrice: ListingPriceAutofill | undefined;
  let supplierCost: ListingPriceAutofill | undefined;
  let featured: AutofillCheckboxField | undefined;

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const leftover: string[] = [];

  for (const line of lines) {
    const labelMoney = tryParseLabelThenMoney(line);
    if (labelMoney) {
      const nk = normalizeAutofillKey(labelMoney.labelKey);
      const isListing =
        CAR_LISTING_PRICE_LABELS.has(nk) ||
        (nk.includes("sell") && nk.includes("price")) ||
        nk === "basesellingprice";
      const isSupplier =
        CAR_SUPPLIER_COST_LABELS.has(nk) || nk === "cost" || nk === "costrmb" || nk === "suppliercost";
      if (isSupplier) {
        supplierCost = mergeListingPrice(supplierCost, {
          amount: labelMoney.amount,
          currency: labelMoney.currency,
          confidence: labelMoney.confidence,
        });
      } else if (isListing) {
        listingPrice = mergeListingPrice(listingPrice, {
          amount: labelMoney.amount,
          currency: labelMoney.currency,
          confidence: labelMoney.confidence,
        });
      } else {
        leftover.push(line);
      }
      continue;
    }

    const spLine = tryParseSpaceSeparatedLabelLine(line, CAR_SPACE_LABEL_KEYS, { maxLabelTokens: 4 });
    const colonLabeled = !spLine?.valueRest ? tryParseLabelValueLine(line) : null;

    let alias: string | null = null;
    let value = "";
    let lineConfidence: AutofillConfidence = "explicit";
    let labelRawForUnmapped = "";

    if (spLine?.valueRest) {
      alias = spLine.normKey;
      value = stripWeakTrailingPunctuation(clipTrailingClause(spLine.valueRest));
      lineConfidence = "explicit";
      labelRawForUnmapped = line.split(/\s+/).slice(0, 4).join(" ");
    } else if (colonLabeled) {
      alias = normalizeAutofillKey(colonLabeled.labelRaw);
      value = stripWeakTrailingPunctuation(colonLabeled.valueRaw);
      lineConfidence = colonLabeled.confidence;
      labelRawForUnmapped = colonLabeled.labelRaw;
    }

    if (alias) {
      if (alias === "year" || alias === "yr" || alias === "modelyear") {
        const y = parsePlainAmount(value.replace(/\bkm\b.*$/i, ""));
        if (y != null && y >= 1980 && y <= 2035) setNum(numberFields, "year", Math.round(y), lineConfidence);
        continue;
      }
      if (alias === "mileage" || alias === "odometer" || alias === "odo") {
        const km = extractMileageKm(`${value} km`) ?? parsePlainAmount(value.replace(/[^\d.,]/g, ""));
        if (km != null) setNum(numberFields, "mileage", Math.round(km), lineConfidence);
        continue;
      }

      if (
        CAR_LISTING_PRICE_LABELS.has(alias) ||
        alias === "price" ||
        alias === "listprice" ||
        alias === "asking" ||
        alias === "retail"
      ) {
        const money = parseMoneyWithCurrency(value) ?? parseMoneyWithCurrency(line);
        if (money) {
          listingPrice = mergeListingPrice(listingPrice, {
            amount: money.amount,
            currency: money.currency,
            confidence: lineConfidence,
          });
        }
        continue;
      }

      if (
        CAR_SUPPLIER_COST_LABELS.has(alias) ||
        alias === "suppliercostrmb" ||
        alias === "costrmb" ||
        alias === "cost" ||
        alias === "dealercost"
      ) {
        const money = parseMoneyWithCurrency(value);
        if (money) {
          supplierCost = mergeListingPrice(supplierCost, {
            amount: money.amount,
            currency: money.currency,
            confidence: lineConfidence,
          });
        } else {
          const n = parsePlainAmount(value);
          if (n != null && n > 0) {
            supplierCost = mergeListingPrice(supplierCost, {
              amount: n,
              currency: "CNY",
              confidence: lineConfidence,
            });
          }
        }
        continue;
      }

      if (alias === "featured" || alias === "spotlight") {
        featured = { value: /^(1|yes|true|on|y)$/i.test(value), confidence: lineConfidence };
        continue;
      }
      if (alias === "enginetype") {
        const e = resolveEngineType(value);
        if (e) engineTypeEnum = { value: e, confidence: lineConfidence };
        continue;
      }
      if (alias === "source" || alias === "sourcetype") {
        const s = resolveSourceType(value);
        if (s) sourceTypeEnum = { value: s, confidence: lineConfidence };
        continue;
      }
      if (alias === "availability" || alias === "stock") {
        const s = resolveAvailability(value);
        if (s) availabilityEnum = { value: s, confidence: lineConfidence };
        continue;
      }
      if (alias === "listing" || alias === "listingstate" || alias === "visibility") {
        const s = resolveListingState(value);
        if (s) listingStateEnum = { value: s, confidence: lineConfidence };
        continue;
      }
      if (alias === "engine" || alias === "motor") {
        const e = resolveEngineType(value);
        if (e) engineTypeEnum = { value: e, confidence: lineConfidence };
        else setField(stringFields, "engineDetails", value, lineConfidence, true);
        continue;
      }
      if (alias === "fuel" || alias === "fueltype") {
        const e = resolveEngineType(value);
        if (e) engineTypeEnum = { value: e, confidence: lineConfidence };
        continue;
      }

      const formName = CAR_LINE_FIELD[alias];
      if (formName) {
        const v =
          formName === "title" || formName === "shortDescription" ? clipTrailingClause(value) : value;
        setField(stringFields, formName, v, lineConfidence, formName === "engineDetails");
        continue;
      }
      unmappedConcepts.push(labelRawForUnmapped || line.slice(0, 64));
      continue;
    }

    leftover.push(line);
  }

  const blob = leftover.join("\n").trim() || raw.trim();
  if (blob) {
    for (const segment of blob.split(",").map((s) => s.trim()).filter(Boolean)) {
      const low = segment.toLowerCase();
      if (/price|ghs|rmb|cedis|¥|\$|asking/i.test(segment)) {
        const p = parseMoneySegment(segment);
        if (p && !listingPrice) {
          const cur: AdminPriceCurrency =
            p.currency === "RMB" || p.currency === "CNY" ? "CNY" : p.currency === "USD" ? "USD" : "GHS";
          listingPrice = mergeListingPrice(listingPrice, {
            amount: p.amount,
            currency: cur,
            confidence: "heuristic",
          });
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

    if (!listingPrice) {
      const best = findBestMoneyInText(blob);
      if (best) {
        listingPrice = mergeListingPrice(listingPrice, { ...best, confidence: "heuristic" });
      }
    }

    if (!stringFields.title && blob.split("\n").length === 1 && blob.length <= 120 && !extractVin(blob)) {
      setField(stringFields, "title", blob, "heuristic");
    } else if (!stringFields.shortDescription && blob.length > 0) {
      setField(stringFields, "shortDescription", blob.slice(0, 500), "heuristic");
    }
  }

  let basePriceRmb: AutofillNumberField | undefined;
  let listPriceAlternate: AutofillPriceField | undefined;
  if (listingPrice?.currency === "CNY") {
    basePriceRmb = { value: listingPrice.amount, confidence: listingPrice.confidence };
  } else if (listingPrice) {
    listPriceAlternate = {
      amount: listingPrice.amount,
      currency: listingPrice.currency,
      confidence: listingPrice.confidence,
    };
  }

  if (supplierCost?.currency === "CNY") {
    setNum(numberFields, "supplierCostRmb", supplierCost.amount, supplierCost.confidence, true);
  }

  return {
    stringFields,
    numberFields,
    engineTypeEnum,
    sourceTypeEnum,
    availabilityEnum,
    listingStateEnum,
    listingPrice,
    supplierCost,
    basePriceRmb,
    listPriceAlternate,
    featured,
    unmappedConcepts,
  };
}

/** Normalized label → Part form `name` (matches `part-form` inputs). */
const PART_LINE_FIELD: Record<string, keyof PartSummaryAutofillResult["stringFields"]> = {
  title: "title",
  name: "title",
  partname: "title",
  product: "title",
  listingname: "title",
  category: "category",
  cat: "category",
  sku: "sku",
  stockkeepingunit: "sku",
  partnumber: "partNumber",
  partno: "partNumber",
  part: "partNumber",
  pn: "partNumber",
  pno: "partNumber",
  oem: "oemNumber",
  oemnumber: "oemNumber",
  oemno: "oemNumber",
  oemcode: "oemNumber",
  summary: "shortDescription",
  short: "shortDescription",
  shortdescription: "shortDescription",
  description: "description",
  long: "description",
  details: "description",
  tags: "tags",
  brand: "brand",
  manufacturer: "brand",
  mfr: "brand",
  make: "compatibleMake",
  vehiclemake: "compatibleMake",
  compatiblemake: "compatibleMake",
  model: "compatibleModel",
  vehiclemodel: "compatibleModel",
  compatiblemodel: "compatibleModel",
  condition: "condition",
  location: "warehouseLocation",
  warehouse: "warehouseLocation",
  bin: "warehouseLocation",
  warehouselocation: "warehouseLocation",
  country: "countryOfOrigin",
  countryoforigin: "countryOfOrigin",
  coo: "countryOfOrigin",
  origincountry: "countryOfOrigin",
  notes: "internalNotes",
  internal: "internalNotes",
  internalnotes: "internalNotes",
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

/** Lines like "Honda CRV 2017-2022" → structured compatibility (no label text in values). */
export function parseCompatibleVehicleValue(val: string): {
  compatibleMake?: string;
  compatibleModel?: string;
  compatibleYearNote?: string;
} {
  const t = val.trim();
  if (!t) return {};
  if (/^(?:19|20)\d{2}(?:\s*-\s*(?:19|20)\d{2})?$/.test(t.replace(/\s/g, ""))) {
    const compact = t.replace(/\s/g, "");
    return { compatibleYearNote: compact };
  }
  if (/^(?:19|20)\d{2}$/.test(t)) {
    return { compatibleYearNote: t };
  }
  const rangeMatch = /\b((?:19|20)\d{2})\s*-\s*((?:19|20)\d{2})\s*$/i.exec(t);
  const singleYear = /\b((?:19|20)\d{2})\s*$/i.exec(t);
  let yearNote: string | undefined;
  let rest = t;
  if (rangeMatch) {
    yearNote = `${rangeMatch[1]}-${rangeMatch[2]}`;
    rest = t.slice(0, rangeMatch.index).trim();
  } else if (singleYear) {
    const before = t.slice(0, singleYear.index).trim();
    if (before.length > 0) {
      yearNote = singleYear[1];
      rest = before;
    } else {
      return { compatibleYearNote: singleYear[1] };
    }
  }
  const parts = rest.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      compatibleMake: parts[0],
      compatibleModel: parts.slice(1).join(" "),
      ...(yearNote ? { compatibleYearNote: yearNote } : {}),
    };
  }
  if (yearNote) return { compatibleYearNote: yearNote };
  return {};
}

function mergeVehicleParsed(
  stringFields: Partial<Record<string, AutofillStringField>>,
  parsed: ReturnType<typeof parseCompatibleVehicleValue>,
  confidence: AutofillConfidence,
) {
  if (parsed.compatibleMake) setField(stringFields, "compatibleMake", parsed.compatibleMake, confidence, true);
  if (parsed.compatibleModel) setField(stringFields, "compatibleModel", parsed.compatibleModel, confidence, true);
  if (parsed.compatibleYearNote) setField(stringFields, "compatibleYearNote", parsed.compatibleYearNote, confidence, true);
}

function resolvePartOrigin(val: string): PartOrigin | undefined {
  const n = normalizeAutofillKey(val);
  if (n.includes("china") || n.includes("rmb") || n.includes("preorder")) return PartOrigin.CHINA;
  if (n.includes("ghana") || n.includes("local") || n.includes("ghs")) return PartOrigin.GHANA;
  return undefined;
}

const PART_PRICE_LABELS = new Set(
  [
    "price",
    "listprice",
    "sellingprice",
    "sellprice",
    "retail",
    "msrp",
    "basesellingprice",
    "basesaleprice",
    "baseprice",
    "asking",
  ].map((k) => normalizePasteLabel(k)),
);
const PART_SUPPLIER_LABELS = new Set(
  [
    "suppliercost",
    "supplier",
    "dealercost",
    "dealershipcost",
    "buyingcost",
    "buycost",
    "costprice",
    "landedcost",
    "invoicecost",
    "costrmb",
    "suppliercostrmb",
  ].map((k) => normalizePasteLabel(k)),
);

const PART_VEHICLE_BUNDLE_ALIASES = new Set(
  [
    "compatiblevehicle",
    "compatible",
    "vehiclefit",
    "fitment",
    "fits",
    "fit",
    "for",
    "vehicle",
    "compatibility",
    "applications",
    "application",
    "vehicles",
  ].map((k) => normalizePasteLabel(k)),
);

const PART_SPACE_LABEL_KEYS: Set<string> = (() => {
  const s = new Set<string>();
  for (const k of Object.keys(PART_LINE_FIELD)) s.add(k);
  PART_PRICE_LABELS.forEach((x) => s.add(x));
  PART_SUPPLIER_LABELS.forEach((x) => s.add(x));
  PART_VEHICLE_BUNDLE_ALIASES.forEach((x) => s.add(x));
  for (const extra of [
    "origin",
    "lane",
    "partnumber",
    "partno",
    "pn",
    "oem",
    "sku",
    "qty",
    "quantity",
    "stock",
    "featured",
    "year",
    "years",
    "make",
    "model",
    "priceghs",
    "pricermb",
    "ghs",
    "cedis",
    "rmb",
    "cny",
    "suppliercost",
    "dealercost",
    "cost",
    "lockstock",
    "stockstatuslocked",
    "modelyear",
    "compatibleyear",
    "vehicleyear",
    "vehiclemake",
    "compatiblemake",
    "vehiclemodel",
    "compatiblemodel",
  ]) {
    s.add(extra);
  }
  return s;
})();

/**
 * Part paste summary: labeled lines + conservative heuristics (max 30 non-empty lines).
 */
export function parsePartSummaryForAutofill(raw: string): PartSummaryAutofillResult {
  const stringFields: Partial<Record<string, AutofillStringField>> = {};
  const numberFields: Partial<Record<string, AutofillNumberField>> = {};
  let originEnum: PartSummaryAutofillResult["originEnum"];
  let listPrice: ListingPriceAutofill | undefined;
  let supplierCost: ListingPriceAutofill | undefined;
  let featured: AutofillCheckboxField | undefined;
  let stockStatusLocked: AutofillCheckboxField | undefined;
  const unmappedConcepts: string[] = [];

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 30);
  const loose: string[] = [];

  for (const line of lines) {
    const labelMoney = tryParseLabelThenMoney(line);
    if (labelMoney) {
      const nk = normalizeAutofillKey(labelMoney.labelKey);
      const isList =
        PART_PRICE_LABELS.has(nk) ||
        nk === "basesellingprice" ||
        (nk.includes("sell") && nk.includes("price")) ||
        nk === "sellingprice";
      const isSupplier = PART_SUPPLIER_LABELS.has(nk) || nk === "cost" || nk === "dealercost";
      if (isSupplier && !isList) {
        supplierCost = mergeListingPrice(supplierCost, {
          amount: labelMoney.amount,
          currency: labelMoney.currency,
          confidence: labelMoney.confidence,
        });
      } else if (isList) {
        listPrice = mergeListingPrice(listPrice, {
          amount: labelMoney.amount,
          currency: labelMoney.currency,
          confidence: labelMoney.confidence,
        });
      } else {
        loose.push(line);
      }
      continue;
    }

    const spLine = tryParseSpaceSeparatedLabelLine(line, PART_SPACE_LABEL_KEYS, { maxLabelTokens: 4 });
    const colonLabeled = !spLine?.valueRest ? tryParseLabelValueLine(line) : null;

    let alias: string | null = null;
    let value = "";
    let lineConfidence: AutofillConfidence = "explicit";
    let labelRawForUnmapped = "";

    if (spLine?.valueRest) {
      alias = spLine.normKey;
      value = stripWeakTrailingPunctuation(clipTrailingClause(spLine.valueRest));
      lineConfidence = "explicit";
      labelRawForUnmapped = line.split(/\s+/).slice(0, 4).join(" ");
    } else if (colonLabeled) {
      alias = normalizeAutofillKey(colonLabeled.labelRaw);
      value = stripWeakTrailingPunctuation(colonLabeled.valueRaw);
      lineConfidence = colonLabeled.confidence;
      labelRawForUnmapped = colonLabeled.labelRaw;
    }

    if (!alias) {
      loose.push(line);
      continue;
    }

    if (alias === "origin" || alias === "lane") {
      const o = resolvePartOrigin(value);
      if (o) originEnum = { value: o, confidence: lineConfidence };
      continue;
    }
    if (alias === "price" || alias === "listprice" || PART_PRICE_LABELS.has(alias)) {
      const p = parseMoneyWithCurrency(value) ?? parseMoneyWithCurrency(line);
      if (p) {
        listPrice = mergeListingPrice(listPrice, {
          amount: p.amount,
          currency: p.currency,
          confidence: lineConfidence,
        });
      }
      continue;
    }
    if (
      alias === "suppliercost" ||
      alias === "suppliercostrmb" ||
      alias === "costrmb" ||
      alias === "dealercost" ||
      alias === "cost" ||
      PART_SUPPLIER_LABELS.has(alias)
    ) {
      const money = parseMoneyWithCurrency(value);
      if (money) {
        supplierCost = mergeListingPrice(supplierCost, { ...money, confidence: lineConfidence });
      } else {
        const n = parsePlainAmount(value);
        if (n != null && n > 0) {
          supplierCost = mergeListingPrice(supplierCost, {
            amount: n,
            currency: "CNY",
            confidence: lineConfidence,
          });
        }
      }
      continue;
    }
    if (alias === "priceghs" || alias === "ghs" || alias === "cedis") {
      const n = parseFloat(value.replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0) {
        listPrice = mergeListingPrice(listPrice, { amount: n, currency: "GHS", confidence: lineConfidence });
      }
      continue;
    }
    if (alias === "pricermb" || alias === "rmb" || alias === "cny") {
      const n = parseFloat(value.replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0) {
        listPrice = mergeListingPrice(listPrice, { amount: n, currency: "CNY", confidence: lineConfidence });
      }
      continue;
    }
    if (alias === "stock" || alias === "qty" || alias === "quantity") {
      const n = parseInt(value.replace(/,/g, ""), 10);
      if (Number.isFinite(n) && n >= 0) setNum(numberFields, "stockQty", n, lineConfidence);
      continue;
    }
    if (
      alias === "year" ||
      alias === "years" ||
      alias === "modelyear" ||
      alias === "compatibleyear" ||
      alias === "vehicleyear"
    ) {
      const y = clipTrailingClause(value).trim();
      if (y) setField(stringFields, "compatibleYearNote", y, lineConfidence);
      continue;
    }
    if (alias === "make" || alias === "vehiclemake" || alias === "compatiblemake") {
      setField(stringFields, "compatibleMake", clipTrailingClause(value), lineConfidence);
      continue;
    }
    if (alias === "model" || alias === "vehiclemodel" || alias === "compatiblemodel") {
      setField(stringFields, "compatibleModel", clipTrailingClause(value), lineConfidence);
      continue;
    }
    if (PART_VEHICLE_BUNDLE_ALIASES.has(alias)) {
      mergeVehicleParsed(stringFields, parseCompatibleVehicleValue(value), lineConfidence);
      continue;
    }
    if (alias === "featured") {
      featured = { value: /^(1|yes|true|on|y)$/i.test(value), confidence: lineConfidence };
      continue;
    }
    if (alias === "lockstock" || alias === "stockstatuslocked") {
      stockStatusLocked = { value: /^(1|yes|true|on|y)$/i.test(value), confidence: lineConfidence };
      continue;
    }
    const target = PART_LINE_FIELD[alias];
    if (target) {
      const v =
        target === "title" || target === "shortDescription" ? clipTrailingClause(value) : clipTrailingClause(value);
      setField(stringFields, target, v, lineConfidence, target === "description" || target === "tags" || target === "internalNotes");
      continue;
    }
    unmappedConcepts.push(labelRawForUnmapped || line.slice(0, 64));
  }

  const blob = loose.join("\n").trim();
  if (blob) {
    for (const segment of blob.split(",").map((s) => s.trim()).filter(Boolean)) {
      const p = parseMoneySegment(segment);
      if (p) {
        const cur: AdminPriceCurrency =
          p.currency === "RMB" || p.currency === "CNY" ? "CNY" : p.currency === "USD" ? "USD" : "GHS";
        if (!listPrice) {
          listPrice = mergeListingPrice(listPrice, { amount: p.amount, currency: cur, confidence: "heuristic" });
        }
        continue;
      }
      const q = /^(?:qty|stock|quantity)\s*:?\s*(\d+)/i.exec(segment);
      if (q) {
        const n = parseInt(q[1], 10);
        if (Number.isFinite(n)) setNum(numberFields, "stockQty", n, "heuristic");
      }
    }
    if (!listPrice) {
      const best = findBestMoneyInText(blob);
      if (best) listPrice = mergeListingPrice(listPrice, { ...best, confidence: "heuristic" });
    }
    if (!stringFields.title && blob.length <= 120 && !blob.includes("\n")) {
      setField(stringFields, "title", blob, "heuristic");
    } else if (!stringFields.shortDescription) {
      setField(stringFields, "shortDescription", blob.slice(0, 500), "heuristic");
    }
  }

  return {
    stringFields,
    numberFields,
    originEnum,
    listPrice,
    supplierCost,
    featured,
    stockStatusLocked,
    unmappedConcepts,
  };
}

/** Human-readable rows for paste-summary preview UI. */
export function previewRowsFromCarParse(parsed: CarSummaryAutofillResult): AutofillPreviewRow[] {
  const rows: AutofillPreviewRow[] = [];
  if (parsed.listingPrice) {
    rows.push({
      field: "Base selling price",
      value: `${parsed.listingPrice.amount.toLocaleString()} ${parsed.listingPrice.currency}`,
      confidence: parsed.listingPrice.confidence,
    });
  }
  if (parsed.supplierCost) {
    rows.push({
      field: "Supplier / dealership cost",
      value: `${parsed.supplierCost.amount.toLocaleString()} ${parsed.supplierCost.currency}`,
      confidence: parsed.supplierCost.confidence,
    });
  }
  for (const [k, v] of Object.entries(parsed.stringFields)) {
    if (!v?.value) continue;
    rows.push({
      field: k,
      value: v.value.length > 80 ? `${v.value.slice(0, 77)}…` : v.value,
      confidence: v.confidence,
    });
  }
  for (const [k, v] of Object.entries(parsed.numberFields)) {
    if (v == null) continue;
    rows.push({ field: k, value: String(v.value), confidence: v.confidence });
  }
  if (parsed.engineTypeEnum)
    rows.push({ field: "engineType", value: parsed.engineTypeEnum.value, confidence: parsed.engineTypeEnum.confidence });
  if (parsed.sourceTypeEnum)
    rows.push({ field: "sourceType", value: parsed.sourceTypeEnum.value, confidence: parsed.sourceTypeEnum.confidence });
  if (parsed.availabilityEnum)
    rows.push({ field: "availability", value: parsed.availabilityEnum.value, confidence: parsed.availabilityEnum.confidence });
  if (parsed.listingStateEnum)
    rows.push({ field: "listingState", value: parsed.listingStateEnum.value, confidence: parsed.listingStateEnum.confidence });
  if (parsed.featured)
    rows.push({ field: "featured", value: String(parsed.featured.value), confidence: parsed.featured.confidence });
  return rows;
}

const PART_PREVIEW_LABELS: Record<string, string> = {
  title: "Title",
  category: "Category",
  sku: "SKU",
  partNumber: "Part number",
  oemNumber: "OEM number",
  brand: "Brand (manufacturer)",
  compatibleMake: "Compatible make",
  compatibleModel: "Compatible model",
  compatibleYearNote: "Compatible years",
  condition: "Condition",
  warehouseLocation: "Location / warehouse",
  countryOfOrigin: "Country of origin",
  internalNotes: "Internal notes",
  shortDescription: "Short description",
  description: "Description",
  tags: "Tags",
  supplierDistributorRef: "Supplier reference",
  supplierDistributorPhone: "Supplier phone",
  optionColors: "Color options",
  optionSizes: "Size options",
};

export function previewRowsFromPartParse(parsed: PartSummaryAutofillResult): AutofillPreviewRow[] {
  const rows: AutofillPreviewRow[] = [];
  if (parsed.listPrice) {
    rows.push({
      field: "Selling price",
      value: `${parsed.listPrice.amount.toLocaleString()} ${parsed.listPrice.currency}`,
      confidence: parsed.listPrice.confidence,
    });
  }
  if (parsed.supplierCost) {
    rows.push({
      field: "Supplier cost",
      value: `${parsed.supplierCost.amount.toLocaleString()} ${parsed.supplierCost.currency}`,
      confidence: parsed.supplierCost.confidence,
    });
  }
  for (const [k, v] of Object.entries(parsed.stringFields)) {
    if (!v?.value) continue;
    const label = PART_PREVIEW_LABELS[k] ?? k;
    const val = v.value.length > 80 ? `${v.value.slice(0, 77)}…` : v.value;
    rows.push({ field: label, value: val, confidence: v.confidence });
  }
  for (const [k, v] of Object.entries(parsed.numberFields)) {
    if (v == null) continue;
    const label = k === "stockQty" ? "Stock quantity" : k;
    rows.push({ field: label, value: String(v.value), confidence: v.confidence });
  }
  if (parsed.originEnum)
    rows.push({ field: "Origin lane", value: parsed.originEnum.value, confidence: parsed.originEnum.confidence });
  if (parsed.featured) rows.push({ field: "Featured", value: String(parsed.featured.value), confidence: parsed.featured.confidence });
  if (parsed.stockStatusLocked)
    rows.push({
      field: "Lock stock status",
      value: String(parsed.stockStatusLocked.value),
      confidence: parsed.stockStatusLocked.confidence,
    });
  return rows;
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
