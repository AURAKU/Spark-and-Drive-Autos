import type { CalculationLineItem, DutyConfidenceLevel, DutyIntelligenceResult } from "@/lib/duty-intelligence/types";
import { dutyCalculationInputSchema } from "@/lib/duty-intelligence/types";
import { reconcilePayableDutyLines } from "@/lib/duty-intelligence/charge-reconciliation";
import { DUTY_ESTIMATE_DISCLAIMER_LONG, DUTY_ESTIMATE_DISCLAIMER_SHORT } from "@/lib/duty/disclaimer";
import { engineTypeLabel } from "@/lib/engine-type-ui";
import { LEGAL_COMPANY } from "@/lib/legal";

export type DutyReportLine = {
  category: string;
  chargeName: string;
  taxableBaseLabel: string;
  taxableBaseAmount: number | null;
  rateLabel: string | null;
  payableAmount: number;
  code: string;
  lineNo: string;
};

export type DutyReportSpecChip = {
  label: string;
  value: string;
};

export type DutyReportCompany = {
  brandName: string;
  legalName: string;
  websiteHost: string;
  websiteUrl: string;
  phone: string;
  address: string;
  registrationNumber: string;
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
  vehicleTitle: string;
  specChips: DutyReportSpecChip[];
  company: DutyReportCompany;
  dutyLines: DutyReportLine[];
  dutyGroups: Array<{ heading: string; lines: DutyReportLine[] }>;
  totals: {
    customsDutyGhs: number | null;
    taxesAndLeviesGhs: number | null;
    portAndAdminChargesGhs: number | null;
    estimatedDutyPayableGhs: number;
    estimatedDutyPayableUsd: number | null;
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

export function formatSheetNumber(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "0.00";
  return moneyNumber(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatSheetRate(rate: number | null | undefined, rateType?: string | null): string {
  if (rate == null || !Number.isFinite(rate)) return "1.00";
  const isPercent = rateType === "PERCENTAGE" || rateType === "PERCENT" || rateType === "BLENDED" || rate > 1;
  const decimal = isPercent && rate > 1 ? rate / 100 : isPercent ? rate : rate;
  if (rateType === "FIXED") return "1.00";
  return decimal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function websiteParts(raw?: string | null): { host: string; url: string } {
  const fallbackHost = "www.sparkanddriveautos.com";
  const fallbackUrl = "https://www.sparkanddriveautos.com";
  const value = (raw ?? "").trim();
  if (!value) return { host: fallbackHost, url: fallbackUrl };
  try {
    const u = new URL(value.startsWith("http") ? value : `https://${value}`);
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      return { host: fallbackHost, url: fallbackUrl };
    }
    return {
      host: host === "sparkanddriveautos.com" ? fallbackHost : u.hostname,
      url: `https://${u.hostname}`,
    };
  } catch {
    return { host: fallbackHost, url: fallbackUrl };
  }
}

export function buildDutyReportPreview(params: {
  input: unknown;
  result: DutyIntelligenceResult;
  reference?: string;
}): DutyReportData {
  const stamp = new Date();
  const ymd = stamp.toISOString().slice(0, 10).replace(/-/g, "");
  return buildDutyReportData({
    calculationId: "preview",
    reportReference: params.reference?.trim() || `SDA-${ymd}`,
    generatedAt: stamp,
    preparedBy: "Spark & Drive Autos",
    inputJson: params.input,
    resultJson: params.result,
  });
}

function inferTaxableBase(params: {
  amount: number;
  rate?: number;
  rateType?: string;
  customsValueGhs: number;
  cifGhs: number;
}): number | null {
  const { amount, rate, rateType, customsValueGhs, cifGhs } = params;
  if (rateType === "FIXED" || rate == null || !Number.isFinite(rate) || rate === 0) {
    return amount > 0 && (rateType === "FIXED" || rate === 1) ? amount : customsValueGhs || cifGhs || null;
  }
  const decimal = rate > 1 ? rate / 100 : rate;
  if (decimal === 0) return customsValueGhs || cifGhs || null;
  return moneyNumber(amount / decimal);
}

function buildVehicleTitle(params: {
  year?: number | null;
  make?: string | null;
  model?: string | null;
  category?: string | null;
  engineCc?: number | null;
}): string {
  const parts = [
    params.year != null ? String(params.year) : null,
    params.make?.trim(),
    params.model?.trim(),
    params.category?.trim(),
    params.engineCc != null ? `${params.engineCc >= 1000 ? (params.engineCc / 1000).toFixed(1).replace(/\.0$/, "") : params.engineCc}` : null,
  ].filter(Boolean);
  return parts.join(" ") || "Vehicle import duty estimate";
}

function depreciationFromAssumptions(assumptions: string[]): number | null {
  for (const line of assumptions) {
    const match = line.match(/(\d+(?:\.\d+)?)\s*%[^\n]{0,24}depreciat/i) ?? line.match(/depreciat[^\n]{0,24}(\d+(?:\.\d+)?)\s*%/i);
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
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
  const reconciliation = reconcilePayableDutyLines(
    result.payableDutyLines?.length ? result.payableDutyLines : result.lineItems,
    { expectedTotalGhs: result.summary?.totalGraTaxesGhs },
  );
  const chargeItems = reconciliation.payableLines;
  const customsValueGhs = moneyNumber(result.summary.customsValueGhs);
  const cifGhs = moneyNumber(result.summary.cifGhs);
  const dutyLines: DutyReportLine[] = chargeItems.map((item, index) => {
    const payableAmount = moneyNumber(item.amountGhs);
    const taxableBaseAmount = inferTaxableBase({
      amount: payableAmount,
      rate: item.rate,
      rateType: item.rateType,
      customsValueGhs,
      cifGhs,
    });
    return {
      category: item.category,
      chargeName: item.label,
      taxableBaseLabel: item.basis || "Assessed value",
      taxableBaseAmount,
      rateLabel: formatSheetRate(item.rate, item.rateType),
      payableAmount,
      code: item.code,
      lineNo: String(index + 1).padStart(2, "0"),
    };
  });

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

  const ageYears = result.vehicleClassification?.ageYears;
  const depreciationPercent = depreciationFromAssumptions(assumptions);
  const web = websiteParts(params.website);
  const fxRate = moneyNumber(result.exchangeRate?.rate);
  const payableGhs = reconciliation.totalEstimatedDutyPayableGhs;
  const payableUsd = fxRate > 0 ? moneyNumber(payableGhs / fxRate) : null;
  const fuelLabel = vehicle?.fuelType ? engineTypeLabel(vehicle.fuelType) : null;
  const fuelAndCc =
    fuelLabel && vehicle?.engineCc
      ? `${fuelLabel} ${vehicle.engineCc}`
      : fuelLabel ?? (vehicle?.engineCc != null ? `${vehicle.engineCc} cc` : null);
  const specChips: DutyReportSpecChip[] = [
    { label: "Type", value: result.vehicleClassification?.commercial ? "Commercial" : "Passenger" },
    ...(fuelAndCc ? [{ label: "Fuel & CC", value: fuelAndCc }] : []),
    ...(ageYears != null ? [{ label: "On arrival", value: `${Number(ageYears).toFixed(1)} yrs` }] : []),
    ...(depreciationPercent != null ? [{ label: "Depreciation", value: `${depreciationPercent.toFixed(1)}%` }] : []),
    ...(fxRate > 0
      ? [{ label: "FX rate", value: `${fxRate.toLocaleString("en-US", { maximumFractionDigits: 5 })}` }]
      : []),
  ];

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
    vehicleTitle: buildVehicleTitle({
      year: vehicle?.year,
      make: vehicle?.manufacturer,
      model: vehicle?.model,
      category: vehicle?.vehicleCategory ?? result.vehicleClassification?.category,
      engineCc: vehicle?.engineCc,
    }),
    specChips,
    company: {
      brandName: "Spark & Drive Autos",
      legalName: LEGAL_COMPANY.businessName,
      websiteHost: web.host,
      websiteUrl: web.url,
      phone: LEGAL_COMPANY.phone,
      address: LEGAL_COMPANY.officeAddress,
      registrationNumber: LEGAL_COMPANY.registrationNumber,
    },
    costInputs: {
      purchaseCurrency: purchase?.fobCurrency ?? result.exchangeRate?.fromCurrency ?? "USD",
      fobForeign: purchase?.fobAmount ?? 0,
      freightForeignOrGhs: result.summary.freightGhs,
      insuranceForeignOrGhs: result.summary.insuranceGhs,
      fxRate,
      fxSource: result.exchangeRate?.source ?? null,
      fxEffectiveDate: result.exchangeRate?.effectiveDate ?? null,
      fobGhs: moneyNumber(result.summary.fobGhs),
      freightGhs: moneyNumber(result.summary.freightGhs),
      insuranceGhs: moneyNumber(result.summary.insuranceGhs),
      cifGhs: moneyNumber(result.summary.cifGhs),
      customsValueGhs: moneyNumber(result.summary.customsValueGhs),
      depreciationPercent,
    },
    dutyLines,
    dutyGroups: groupDutyLines(dutyLines),
    totals: {
      customsDutyGhs: customsDuty > 0 ? customsDuty : null,
      taxesAndLeviesGhs: taxesLevies > 0 ? taxesLevies : null,
      portAndAdminChargesGhs: portAdmin > 0 ? portAdmin : null,
      estimatedDutyPayableGhs: payableGhs,
      estimatedDutyPayableUsd: payableUsd,
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
    website: web.url,
  };
}
