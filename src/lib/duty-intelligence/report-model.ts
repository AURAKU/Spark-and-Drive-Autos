import type { CalculationLineItem, DutyConfidenceLevel, DutyIntelligenceResult } from "@/lib/duty-intelligence/types";
import { dutyCalculationInputSchema } from "@/lib/duty-intelligence/types";
import { DUTY_ESTIMATE_DISCLAIMER_LONG, DUTY_ESTIMATE_DISCLAIMER_SHORT } from "@/lib/duty/disclaimer";
import { engineTypeLabel } from "@/lib/engine-type-ui";

export type DutyReportLine = {
  category: string;
  chargeName: string;
  taxableBaseLabel: string;
  taxableBaseAmount: number | null;
  rateLabel: string | null;
  payableAmount: number;
  code: string;
};

export type DutyReportData = {
  reportReference: string;
  calculationId: string;
  generatedAt: string;
  preparedBy: string;
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  vehicle: {
    make: string | null;
    model: string | null;
    trim: string | null;
    manufactureYear: number | null;
    manufactureMonth: number | null;
    vehicleCategory: string | null;
    fuelType: string | null;
    engineCc: number | null;
    powerKw: number | null;
    transmission: string | null;
    drivetrain: string | null;
    seats: number | null;
    weightKg: number | null;
    vinOrChassisMasked: string | null;
    hsCode: string | null;
    originCountry: string | null;
  };
  costInputs: {
    purchaseCurrency: string;
    fobForeign: number;
    freightForeignOrGhs: number | null;
    insuranceForeignOrGhs: number | null;
    fxRate: number;
    fxSource: string | null;
    fxEffectiveDate: string | null;
    fobGhs: number;
    freightGhs: number;
    insuranceGhs: number;
    cifGhs: number;
    customsValueGhs: number;
    depreciationPercent: number | null;
  };
  dutyLines: DutyReportLine[];
  dutyGroups: Array<{ heading: string; lines: DutyReportLine[] }>;
  totals: {
    customsDutyGhs: number | null;
    taxesAndLeviesGhs: number | null;
    portAndAdminChargesGhs: number | null;
    estimatedDutyPayableGhs: number;
    estimatedLandedCostGhs: number;
    lowEstimateGhs: number | null;
    expectedEstimateGhs: number | null;
    highEstimateGhs: number | null;
  };
  confidence: {
    label: string;
    score: number | null;
    reasons: string[];
    uncertaintyReasons: string[];
  };
  assumptions: string[];
  disclaimer: string;
  disclaimerLong: string[];
  ruleSetVersion: string | null;
  website: string;
};

const COST_CATEGORIES = new Set(["FOB", "FREIGHT", "INSURANCE", "CIF", "CUSTOMS", "TOTAL"]);

const GROUP_ORDER: Array<{ heading: string; categories: string[] }> = [
  { heading: "Customs Duty", categories: ["DUTY"] },
  { heading: "Import Taxes", categories: ["VAT"] },
  { heading: "Statutory Levies", categories: ["LEVY"] },
  { heading: "Network and Processing Charges", categories: ["FEE"] },
  { heading: "Port, Shipping Line & Clearing", categories: ["PORT", "SHIPPING_LINE", "AGENT"] },
];

const CONFIDENCE_PUBLIC: Record<DutyConfidenceLevel, string> = {
  VERIFIED_PROFILE_HIGH: "High-confidence estimate",
  STRONG_EVIDENCE: "Standard estimate",
  MODERATE_EVIDENCE: "Standard estimate",
  LIMITED_EVIDENCE: "Limited-data estimate",
  ADMIN_REVIEW_REQUIRED: "Admin review recommended",
};

export function moneyNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100) / 100;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }
  if (value != null && typeof value === "object" && "toString" in value) {
    const n = Number(String(value));
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }
  return 0;
}

export function formatReportMoney(amount: number | null | undefined, currency = "GHS"): string {
  if (amount == null || !Number.isFinite(amount)) return "Not provided";
  const n = moneyNumber(amount);
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function maskVinOrChassis(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const v = value.trim().toUpperCase();
  if (v.length <= 6) return `${v.slice(0, 1)}***${v.slice(-1)}`;
  return `${v.slice(0, 4)}••••${v.slice(-4)}`;
}

/** Deduplicate charge lines by code (keep first), drop valuation totals used elsewhere. */
export function uniqueDutyChargeLines(items: CalculationLineItem[] | null | undefined): CalculationLineItem[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const out: CalculationLineItem[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const code = typeof item.code === "string" ? item.code.trim() : "";
    const label = typeof item.label === "string" ? item.label.trim() : "";
    if (!code && !label) continue;
    if (COST_CATEGORIES.has(item.category)) continue;
    const key = (code || label).toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const amount = moneyNumber(item.amountGhs);
    if (!Number.isFinite(amount)) continue;
    out.push({
      ...item,
      code: code || label,
      label: label || code,
      amountGhs: amount,
    });
  }
  return out;
}

function groupDutyLines(lines: DutyReportLine[]): Array<{ heading: string; lines: DutyReportLine[] }> {
  const used = new Set<string>();
  const groups: Array<{ heading: string; lines: DutyReportLine[] }> = [];
  for (const g of GROUP_ORDER) {
    const subset = lines.filter((l) => g.categories.includes(l.category));
    if (subset.length === 0) continue;
    for (const l of subset) used.add(l.code);
    groups.push({ heading: g.heading, lines: subset });
  }
  const remaining = lines.filter((l) => !used.has(l.code));
  if (remaining.length > 0) {
    groups.push({ heading: "Other Charges", lines: remaining });
  }
  return groups;
}

function rateLabel(item: CalculationLineItem): string | null {
  if (item.rate == null || !Number.isFinite(item.rate)) return null;
  if (item.rateType === "PERCENT" || item.formula?.includes("%")) {
    return `${item.rate}%`;
  }
  return String(item.rate);
}

export function buildDutyReportData(params: {
  calculationId: string;
  reportReference: string;
  generatedAt: Date | string;
  preparedBy?: string | null;
  customer?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  inputJson: unknown;
  resultJson: unknown;
  website?: string;
}): DutyReportData {
  const inputParsed = dutyCalculationInputSchema.safeParse(params.inputJson);
  const result = params.resultJson as DutyIntelligenceResult;
  if (!result || typeof result !== "object" || !("summary" in result)) {
    throw new Error("Malformed calculation result");
  }

  const input = inputParsed.success
    ? inputParsed.data
    : result.inputs && typeof result.inputs === "object"
      ? result.inputs
      : null;

  const vehicle = input?.vehicle;
  const purchase = input?.purchase;
  const chargeItems = uniqueDutyChargeLines(result.lineItems);
  const dutyLines: DutyReportLine[] = chargeItems.map((item) => ({
    category: item.category,
    chargeName: item.label,
    taxableBaseLabel: item.basis || "—",
    taxableBaseAmount: null,
    rateLabel: rateLabel(item),
    payableAmount: moneyNumber(item.amountGhs),
    code: item.code,
  }));

  const customsDuty = chargeItems
    .filter((i) => i.category === "DUTY")
    .reduce((s, i) => s + moneyNumber(i.amountGhs), 0);
  const taxesLevies = chargeItems
    .filter((i) => i.category === "VAT" || i.category === "LEVY")
    .reduce((s, i) => s + moneyNumber(i.amountGhs), 0);
  const portAdmin = chargeItems
    .filter((i) => i.category === "PORT" || i.category === "SHIPPING_LINE" || i.category === "AGENT" || i.category === "FEE")
    .reduce((s, i) => s + moneyNumber(i.amountGhs), 0);

  const confidenceLevel = result.confidence?.level ?? "LIMITED_EVIDENCE";
  const assumptions = [
    ...(result.explanation?.majorAssumptions ?? []),
    ...(result.calibration?.assumptions ?? []),
  ].filter((s, i, arr) => typeof s === "string" && s.trim() && arr.indexOf(s) === i);

  const powerFromSpec = result.vehicleSpec?.inferredFields?.powerKw?.value;
  const powerKw =
    typeof powerFromSpec === "number"
      ? powerFromSpec
      : typeof powerFromSpec === "string" && Number.isFinite(Number(powerFromSpec))
        ? Number(powerFromSpec)
        : null;

  return {
    reportReference: params.reportReference,
    calculationId: params.calculationId,
    generatedAt: typeof params.generatedAt === "string" ? params.generatedAt : params.generatedAt.toISOString(),
    preparedBy: params.preparedBy?.trim() || "Spark & Drive Autos",
    customer: {
      name: params.customer?.name?.trim() || null,
      email: params.customer?.email?.trim() || null,
      phone: params.customer?.phone?.trim() || null,
    },
    vehicle: {
      make: vehicle?.manufacturer ?? null,
      model: vehicle?.model ?? null,
      trim: null,
      manufactureYear: vehicle?.year ?? null,
      manufactureMonth: null,
      vehicleCategory: vehicle?.vehicleCategory ?? result.vehicleClassification?.category ?? null,
      fuelType: vehicle?.fuelType ? engineTypeLabel(vehicle.fuelType) : null,
      engineCc: vehicle?.engineCc ?? null,
      powerKw,
      transmission: vehicle?.transmission ?? null,
      drivetrain: vehicle?.driveType ?? null,
      seats: null,
      weightKg: null,
      vinOrChassisMasked: maskVinOrChassis(vehicle?.vin),
      hsCode: result.hsCode ?? null,
      originCountry: vehicle?.countryOfOrigin ?? null,
    },
    costInputs: {
      purchaseCurrency: purchase?.fobCurrency ?? result.exchangeRate?.fromCurrency ?? "USD",
      fobForeign: purchase?.fobAmount ?? 0,
      freightForeignOrGhs: result.summary.freightGhs,
      insuranceForeignOrGhs: result.summary.insuranceGhs,
      fxRate: moneyNumber(result.exchangeRate?.rate),
      fxSource: result.exchangeRate?.source ?? null,
      fxEffectiveDate: result.exchangeRate?.effectiveDate ?? null,
      fobGhs: moneyNumber(result.summary.fobGhs),
      freightGhs: moneyNumber(result.summary.freightGhs),
      insuranceGhs: moneyNumber(result.summary.insuranceGhs),
      cifGhs: moneyNumber(result.summary.cifGhs),
      customsValueGhs: moneyNumber(result.summary.customsValueGhs),
      depreciationPercent: null,
    },
    dutyLines,
    dutyGroups: groupDutyLines(dutyLines),
    totals: {
      customsDutyGhs: customsDuty > 0 ? customsDuty : null,
      taxesAndLeviesGhs: taxesLevies > 0 ? taxesLevies : null,
      portAndAdminChargesGhs: portAdmin > 0 ? portAdmin : null,
      estimatedDutyPayableGhs: moneyNumber(result.summary.totalGraTaxesGhs),
      estimatedLandedCostGhs: moneyNumber(result.summary.totalLandedCostGhs),
      lowEstimateGhs:
        result.estimateRange?.landedCostLowGhs != null
          ? moneyNumber(result.estimateRange.landedCostLowGhs)
          : result.estimateRange?.lowGhs != null
            ? moneyNumber(result.estimateRange.lowGhs)
            : null,
      expectedEstimateGhs:
        result.estimateRange?.landedCostExpectedGhs != null
          ? moneyNumber(result.estimateRange.landedCostExpectedGhs)
          : result.estimateRange?.expectedGhs != null
            ? moneyNumber(result.estimateRange.expectedGhs)
            : null,
      highEstimateGhs:
        result.estimateRange?.landedCostHighGhs != null
          ? moneyNumber(result.estimateRange.landedCostHighGhs)
          : result.estimateRange?.highGhs != null
            ? moneyNumber(result.estimateRange.highGhs)
            : null,
    },
    confidence: {
      label: CONFIDENCE_PUBLIC[confidenceLevel] ?? "Standard estimate",
      score: result.confidence?.score != null ? moneyNumber(result.confidence.score) : null,
      reasons: Array.isArray(result.confidence?.reasons) ? result.confidence.reasons.filter(Boolean) : [],
      uncertaintyReasons: [
        ...(result.confidence?.uncertaintyReasons ?? []),
        ...(result.explanation?.uncertaintyReasons ?? []),
      ].filter((s, i, arr) => typeof s === "string" && s.trim() && arr.indexOf(s) === i),
    },
    assumptions,
    disclaimer: DUTY_ESTIMATE_DISCLAIMER_SHORT,
    disclaimerLong: [...DUTY_ESTIMATE_DISCLAIMER_LONG],
    ruleSetVersion: result.ruleSetVersion ?? result.formulaVersion ?? null,
    website: params.website ?? "https://www.sparkanddriveautos.com",
  };
}
