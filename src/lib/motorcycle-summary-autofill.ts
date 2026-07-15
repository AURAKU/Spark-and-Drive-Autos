/**
 * Motorcycle paste-summary autofill — reuses the car parser and maps/extends
 * motorcycle-specific fields. Never invents values not present in the paste.
 */

import { CarListingState, EngineType, MotorcycleType, SourceType } from "@prisma/client";

import type {
  AutofillCheckboxField,
  AutofillConfidence,
  AutofillNumberField,
  AutofillPreviewRow,
  AutofillStringField,
  CarSummaryAutofillResult,
  ListingPriceAutofill,
} from "@/lib/admin-summary-autofill";
import { normalizeAutofillKey, parseCarSummaryForAutofill } from "@/lib/admin-summary-autofill";
import {
  clipTrailingClause,
  stripWeakTrailingPunctuation,
  tryParseLabelValueLine,
  tryParseSpaceSeparatedLabelLine,
} from "@/lib/paste-summary/core";

export type MotorcycleSummaryAutofillResult = {
  stringFields: Partial<Record<string, AutofillStringField>>;
  numberFields: Partial<Record<string, AutofillNumberField>>;
  engineTypeEnum?: { value: EngineType; confidence: AutofillConfidence };
  motorcycleTypeEnum?: { value: MotorcycleType; confidence: AutofillConfidence };
  sourceTypeEnum?: { value: SourceType; confidence: AutofillConfidence };
  listingStateEnum?: { value: CarListingState; confidence: AutofillConfidence };
  listingPrice?: ListingPriceAutofill;
  supplierCost?: ListingPriceAutofill;
  featured?: AutofillCheckboxField;
  /** Structured spec rows detected from paste (power, torque, brakes, etc.). */
  specLines: { label: string; value: string; groupName?: string; confidence: AutofillConfidence }[];
  unmappedConcepts: string[];
};

/** Normalized label → motorcycle form field name. */
const MOTORCYCLE_LINE_FIELD: Record<string, string> = {
  make: "brand",
  brand: "brand",
  manufacturer: "brand",
  model: "model",
  year: "year",
  variant: "variant",
  trim: "variant",
  condition: "condition",
  mileage: "mileage",
  km: "mileage",
  odometer: "mileage",
  transmission: "transmission",
  gearbox: "transmission",
  drivetype: "driveType",
  drive: "driveType",
  color: "color",
  colour: "color",
  location: "location",
  place: "location",
  vin: "vin",
  frameno: "frameNumber",
  framenumber: "frameNumber",
  chassis: "frameNumber",
  enginenumber: "engineNumber",
  enginecc: "engineCc",
  displacement: "engineCc",
  cc: "engineCc",
  capacity: "engineCc",
  power: "horsepower",
  horsepower: "horsepower",
  hp: "horsepower",
  torque: "torque",
  weight: "weightKg",
  weightkg: "weightKg",
  kerbweight: "weightKg",
  seatheight: "seatHeight",
  wheelsize: "wheelSize",
  tyre: "tyreSize",
  tyres: "tyreSize",
  tires: "tyreSize",
  tyresize: "tyreSize",
  tiresize: "tyreSize",
  topspeed: "topSpeedKmh",
  topspeedkmh: "topSpeedKmh",
  cooling: "coolingType",
  coolingtype: "coolingType",
  fueltank: "fuelTankCapacity",
  fueltankcapacity: "fuelTankCapacity",
  battery: "batteryCapacity",
  batterycapacity: "batteryCapacity",
  motorpower: "motorPower",
  range: "electricRange",
  electricrange: "electricRange",
  charging: "chargingTime",
  chargingtime: "chargingTime",
  warranty: "warranty",
  description: "longDescription",
  details: "longDescription",
  summary: "longDescription",
  features: "featureTags",
  featuretags: "featureTags",
  highlights: "highlightTags",
  inspection: "inspectionStatus",
  delivery: "estimatedDelivery",
  estimateddelivery: "estimatedDelivery",
};

const SPEC_ONLY_LABELS: Record<string, { label: string; groupName?: string }> = {
  brakes: { label: "Brakes", groupName: "Brakes" },
  brake: { label: "Brakes", groupName: "Brakes" },
  suspension: { label: "Suspension", groupName: "Suspension" },
  frontsuspension: { label: "Front suspension", groupName: "Suspension" },
  rearsuspension: { label: "Rear suspension", groupName: "Suspension" },
  dimensions: { label: "Dimensions", groupName: "Dimensions" },
  length: { label: "Length", groupName: "Dimensions" },
  width: { label: "Width", groupName: "Dimensions" },
  height: { label: "Height", groupName: "Dimensions" },
  wheelbase: { label: "Wheelbase", groupName: "Dimensions" },
  groundclearance: { label: "Ground clearance", groupName: "Dimensions" },
  fronttyre: { label: "Front tyre", groupName: "Tyres" },
  reartyres: { label: "Rear tyre", groupName: "Tyres" },
  reartyre: { label: "Rear tyre", groupName: "Tyres" },
  fronttire: { label: "Front tyre", groupName: "Tyres" },
  reartire: { label: "Rear tyre", groupName: "Tyres" },
};

const MOTORCYCLE_SPACE_KEYS = new Set([
  ...Object.keys(MOTORCYCLE_LINE_FIELD),
  ...Object.keys(SPEC_ONLY_LABELS),
  "fuel",
  "fueltype",
  "enginetype",
  "motorcycletype",
  "biketype",
  "type",
  "status",
  "listing",
  "listingstate",
  "source",
  "sourcetype",
  "price",
  "featured",
]);

function resolveMotorcycleType(val: string): MotorcycleType | undefined {
  const u = val.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if ((Object.values(MotorcycleType) as string[]).includes(u)) return u as MotorcycleType;
  const n = normalizeAutofillKey(val);
  if (n.includes("sport")) return MotorcycleType.SPORT;
  if (n.includes("naked")) return MotorcycleType.NAKED;
  if (n.includes("cruiser")) return MotorcycleType.CRUISER;
  if (n.includes("scooter")) return MotorcycleType.SCOOTER;
  if (n.includes("adventure") || n.includes("adv")) return MotorcycleType.ADVENTURE;
  if (n.includes("touring")) return MotorcycleType.TOURING;
  if (n.includes("dirt") || n.includes("mx") || n.includes("motocross")) return MotorcycleType.DIRT;
  if (n.includes("delivery")) return MotorcycleType.DELIVERY;
  if (n.includes("ebike") || n.includes("electricbike")) return MotorcycleType.ELECTRIC_BIKE;
  if (n.includes("bicycle") || n.includes("ebicycle")) return MotorcycleType.E_BICYCLE;
  if (n.includes("atv") || n.includes("quad")) return MotorcycleType.ATV;
  return undefined;
}

function setStr(
  m: Partial<Record<string, AutofillStringField>>,
  key: string,
  value: string,
  confidence: AutofillConfidence,
) {
  const v = stripWeakTrailingPunctuation(value.trim());
  if (!v || m[key]) return;
  m[key] = { value: v, confidence };
}

function setNum(
  m: Partial<Record<string, AutofillNumberField>>,
  key: string,
  value: number,
  confidence: AutofillConfidence,
) {
  if (!Number.isFinite(value) || m[key]) return;
  m[key] = { value, confidence };
}

function mapCarToMotorcycle(car: CarSummaryAutofillResult): MotorcycleSummaryAutofillResult {
  const stringFields: Partial<Record<string, AutofillStringField>> = {};
  const numberFields: Partial<Record<string, AutofillNumberField>> = { ...car.numberFields };

  const map: Record<string, string> = {
    brand: "brand",
    model: "model",
    transmission: "transmission",
    drivetrain: "driveType",
    colorExterior: "color",
    location: "location",
    vin: "vin",
    condition: "condition",
    longDescription: "longDescription",
    shortDescription: "longDescription",
    inspectionStatus: "inspectionStatus",
    estimatedDelivery: "estimatedDelivery",
    tags: "featureTags",
  };

  for (const [from, to] of Object.entries(map)) {
    const src = car.stringFields[from];
    if (src?.value) setStr(stringFields, to, src.value, src.confidence);
  }

  // engineDetails often holds "249cc" — map to engineCc when numeric
  const eng = car.stringFields.engineDetails?.value;
  if (eng) {
    const cc = /(\d{2,5})\s*cc\b/i.exec(eng);
    if (cc) setNum(numberFields, "engineCc", parseInt(cc[1], 10), car.stringFields.engineDetails!.confidence);
  }

  return {
    stringFields,
    numberFields,
    engineTypeEnum: car.engineTypeEnum,
    sourceTypeEnum: car.sourceTypeEnum,
    listingStateEnum: car.listingStateEnum,
    listingPrice: car.listingPrice,
    supplierCost: car.supplierCost,
    featured: car.featured,
    specLines: [],
    unmappedConcepts: [...car.unmappedConcepts],
  };
}

/**
 * Deterministic motorcycle summary parse. Never invents values.
 * Shows only fields present in the pasted text (via car parser + motorcycle labels).
 */
export function parseMotorcycleSummaryForAutofill(raw: string): MotorcycleSummaryAutofillResult {
  const car = parseCarSummaryForAutofill(raw);
  const base = mapCarToMotorcycle(car);
  const stringFields = { ...base.stringFields };
  const numberFields = { ...base.numberFields };
  const specLines = [...base.specLines];
  const unmappedConcepts = [...base.unmappedConcepts];
  let motorcycleTypeEnum = base.motorcycleTypeEnum;
  const engineTypeEnum = base.engineTypeEnum;
  const sourceTypeEnum = base.sourceTypeEnum;
  const listingStateEnum = base.listingStateEnum;

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const spLine = tryParseSpaceSeparatedLabelLine(line, MOTORCYCLE_SPACE_KEYS, { maxLabelTokens: 3 });
    const colonLabeled = !spLine?.valueRest ? tryParseLabelValueLine(line) : null;

    let alias: string | null = null;
    let value = "";
    let confidence: AutofillConfidence = "explicit";

    if (spLine?.valueRest) {
      alias = spLine.normKey;
      value = stripWeakTrailingPunctuation(clipTrailingClause(spLine.valueRest));
    } else if (colonLabeled) {
      alias = normalizeAutofillKey(colonLabeled.labelRaw);
      value = stripWeakTrailingPunctuation(colonLabeled.valueRaw);
      confidence = colonLabeled.confidence;
    } else {
      continue;
    }

    if (!alias || !value) continue;

    if (alias === "motorcycletype" || alias === "biketype" || alias === "type") {
      const t = resolveMotorcycleType(value);
      if (t) motorcycleTypeEnum = { value: t, confidence };
      continue;
    }
    if (alias === "status") {
      // status → listing/availability language already handled by car parser; skip inventing
      continue;
    }
    if (alias === "fuel" || alias === "fueltype" || alias === "enginetype") {
      // already largely covered by car parser
      continue;
    }

    const specMeta = SPEC_ONLY_LABELS[alias];
    if (specMeta) {
      if (!specLines.some((s) => s.label === specMeta.label && s.value === value)) {
        specLines.push({ ...specMeta, value, confidence });
      }
      continue;
    }

    const formName = MOTORCYCLE_LINE_FIELD[alias];
    if (!formName) continue;

    if (
      formName === "year" ||
      formName === "mileage" ||
      formName === "engineCc" ||
      formName === "horsepower" ||
      formName === "weightKg" ||
      formName === "seatHeight" ||
      formName === "topSpeedKmh"
    ) {
      const n = Number(String(value).replace(/[^\d.]/g, ""));
      if (Number.isFinite(n) && n > 0) setNum(numberFields, formName, Math.round(n), confidence);
      continue;
    }

    setStr(stringFields, formName, value, confidence);
  }

  return {
    stringFields,
    numberFields,
    engineTypeEnum,
    motorcycleTypeEnum,
    sourceTypeEnum,
    listingStateEnum,
    listingPrice: base.listingPrice,
    supplierCost: base.supplierCost,
    featured: base.featured,
    specLines,
    unmappedConcepts,
  };
}

const PREVIEW_LABELS: Record<string, string> = {
  brand: "Make",
  model: "Model",
  year: "Year",
  mileage: "Mileage (km)",
  engineCc: "Engine (cc)",
  horsepower: "Power (hp)",
  torque: "Torque",
  transmission: "Transmission",
  weightKg: "Weight (kg)",
  tyreSize: "Tyres",
  seatHeight: "Seat height",
  location: "Location",
  featureTags: "Features",
  longDescription: "Description",
  color: "Color",
  condition: "Condition",
  variant: "Variant",
  warranty: "Warranty",
};

export function previewRowsFromMotorcycleParse(parsed: MotorcycleSummaryAutofillResult): AutofillPreviewRow[] {
  const rows: AutofillPreviewRow[] = [];
  if (parsed.listingPrice) {
    rows.push({
      field: "Price",
      value: `${parsed.listingPrice.amount.toLocaleString()} ${parsed.listingPrice.currency}`,
      confidence: parsed.listingPrice.confidence,
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
    rows.push({
      field: PREVIEW_LABELS[k] ?? k,
      value: v.value.length > 80 ? `${v.value.slice(0, 77)}…` : v.value,
      confidence: v.confidence,
    });
  }
  for (const [k, v] of Object.entries(parsed.numberFields)) {
    if (v == null) continue;
    rows.push({ field: PREVIEW_LABELS[k] ?? k, value: String(v.value), confidence: v.confidence });
  }
  if (parsed.engineTypeEnum)
    rows.push({ field: "Fuel type", value: parsed.engineTypeEnum.value, confidence: parsed.engineTypeEnum.confidence });
  if (parsed.motorcycleTypeEnum)
    rows.push({
      field: "Motorcycle type",
      value: parsed.motorcycleTypeEnum.value,
      confidence: parsed.motorcycleTypeEnum.confidence,
    });
  if (parsed.sourceTypeEnum)
    rows.push({ field: "Stock location", value: parsed.sourceTypeEnum.value, confidence: parsed.sourceTypeEnum.confidence });
  if (parsed.listingStateEnum)
    rows.push({ field: "Listing state", value: parsed.listingStateEnum.value, confidence: parsed.listingStateEnum.confidence });
  if (parsed.featured)
    rows.push({ field: "Featured", value: String(parsed.featured.value), confidence: parsed.featured.confidence });
  for (const s of parsed.specLines) {
    rows.push({
      field: s.groupName ? `${s.groupName} · ${s.label}` : s.label,
      value: s.value,
      confidence: s.confidence,
    });
  }
  return rows;
}
