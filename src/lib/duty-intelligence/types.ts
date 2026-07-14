import { z } from "zod";

import type {
  DutyChargeCategory,
  DutyCountryCode,
  DutyExportCountry,
  DutyVehicleCategory,
} from "@prisma/client";
import { EngineType as EngineTypeEnum } from "@prisma/client";

export const EXPORT_COUNTRIES = [
  "CHINA",
  "JAPAN",
  "USA",
  "UK",
  "GERMANY",
  "KOREA",
  "DUBAI",
  "SINGAPORE",
  "THAILAND",
  "MALAYSIA",
] as const satisfies readonly DutyExportCountry[];

export const SUPPORTED_CURRENCIES = ["USD", "CNY", "EUR", "GBP", "AED", "JPY", "KRW", "GHS"] as const;

const vehicleCategoryEnum = z.nativeEnum({
  SUV: "SUV",
  SEDAN: "SEDAN",
  PICKUP: "PICKUP",
  TRUCK: "TRUCK",
  BUS: "BUS",
  VAN: "VAN",
} as const satisfies Record<DutyVehicleCategory, DutyVehicleCategory>);

const shippingMethodEnum = z.nativeEnum({
  CONTAINER: "CONTAINER",
  RORO: "RORO",
  AIR_FREIGHT: "AIR_FREIGHT",
  SEA_FREIGHT: "SEA_FREIGHT",
} as const);

const exportCountryEnum = z.enum(EXPORT_COUNTRIES);

export const dutyVehicleInputSchema = z
  .object({
    manufacturer: z.string().trim().min(1, "Manufacturer is required").max(120),
    model: z.string().trim().min(1, "Model is required").max(120),
    year: z
      .number()
      .int()
      .min(1980)
      .max(new Date().getFullYear(), "Year cannot be in the future"),
    vin: z
      .string()
      .trim()
      .max(17)
      .optional()
      .refine((v) => !v || v.length === 17, { message: "VIN must be 17 characters when provided" }),
    countryOfOrigin: exportCountryEnum,
    vehicleCategory: vehicleCategoryEnum,
    fuelType: z.nativeEnum(EngineTypeEnum),
    engineCc: z.number().int().positive("Engine capacity must be greater than zero").max(30_000).optional(),
    transmission: z.string().trim().max(40).optional(),
    driveType: z.string().trim().max(40).optional(),
    batteryKwh: z.number().positive().max(500).optional(),
    applyEvDutyWaiver: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    const iceFuels = ["GASOLINE_PETROL", "GASOLINE_DIESEL", "HYBRID", "PLUGIN_HYBRID"] as const;
    if (iceFuels.includes(data.fuelType as (typeof iceFuels)[number]) && !data.engineCc) {
      ctx.addIssue({ code: "custom", message: "Engine capacity (CC) is required for this fuel type", path: ["engineCc"] });
    }
  });

export const dutyPurchaseInputSchema = z.object({
  fobAmount: z.number().positive("FOB amount must be greater than zero"),
  fobCurrency: z.enum(SUPPORTED_CURRENCIES).default("USD"),
  /** Commercial price basis of the entered purchase amount. Default FOB (never treat FOB as including freight). */
  pricingBasis: z.enum(["FOB", "CFR", "CIF", "EXW", "DDP", "UNKNOWN"]).default("FOB"),
});

export const dutyShippingInputSchema = z.object({
  shippingMethod: shippingMethodEnum.default("SEA_FREIGHT"),
  containerType: z.string().trim().max(40).optional(),
  /** Admin-only overrides — not entered by customers. */
  freightGhsOverride: z.number().nonnegative().optional(),
  insuranceGhsOverride: z.number().nonnegative().optional(),
  otherShippingChargesGhs: z.number().nonnegative().default(0),
});

export const dutyCalculationInputSchema = z.object({
  countryCode: z.nativeEnum({ GH: "GH" } as const).default("GH"),
  vehicle: dutyVehicleInputSchema,
  purchase: dutyPurchaseInputSchema,
  shipping: dutyShippingInputSchema,
  cifGhsOverride: z.number().positive().optional(),
  hsCodeOverride: z.string().trim().max(16).optional(),
  exchangeRateOverride: z.number().positive().optional(),
  carId: z.string().cuid().optional(),
});

export type DutyCalculationInput = z.infer<typeof dutyCalculationInputSchema>;

export type CalculationLineItem = {
  code: string;
  label: string;
  category: "FOB" | "FREIGHT" | "INSURANCE" | "CIF" | "CUSTOMS" | "DUTY" | "LEVY" | "VAT" | "FEE" | "PORT" | "SHIPPING_LINE" | "AGENT" | "TOTAL";
  amountGhs: number;
  basis: string;
  formula: string;
  rate?: number;
  rateType?: string;
  source: "CONFIG" | "HISTORICAL" | "OVERRIDE" | "PREDICTION";
};

export type PipelineStageResult = {
  stage: string;
  label: string;
  output: Record<string, unknown>;
  lineItems: CalculationLineItem[];
  notes: string[];
};

export type DutyConfidenceLevel =
  | "VERIFIED_PROFILE_HIGH"
  | "STRONG_EVIDENCE"
  | "MODERATE_EVIDENCE"
  | "LIMITED_EVIDENCE"
  | "ADMIN_REVIEW_REQUIRED";

export type ConfidenceResult = {
  score: number;
  label: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  level: DutyConfidenceLevel;
  similarImportCount: number;
  basisNote: string;
  reasons: string[];
  uncertaintyReasons?: string[];
};

export type EstimateExplanation = {
  profileUsed: string;
  majorAssumptions: string[];
  whyRangeShown: string;
  couldChangeFinalAmount: string[];
  uncertaintyReasons: string[];
  effectiveRuleDate: string;
  fxRateUsed: number;
  fxSource: string;
  customsValueMethod: string;
  cohortSize: number;
  exactFixtureMatch: boolean;
};

export type EstimateRangeResult = {
  baseGhs: number;
  lowGhs: number;
  highGhs: number;
  bandPct: number;
  expectedGhs: number;
  landedCostLowGhs?: number;
  landedCostExpectedGhs?: number;
  landedCostHighGhs?: number;
};

export type HistoricalComparison = {
  similarImportCount: number;
  avgActualDutyGhs: number | null;
  estimatedDutyGhs: number;
  differencePct: number | null;
  note: string;
};

export type DutyConfigHealth = {
  countryConfigExists: boolean;
  ghanaConfigExists: boolean;
  migrationsApplied: boolean;
  formulaRulesCount: number;
  hsCodesCount: number;
  exchangeRatesCount: number;
  shippingCostMatrixCount: number;
  insuranceRulesCount: number;
  chargeTemplatesCount: number;
  isReady: boolean;
  missing: string[];
};

export type DutyIntelligenceResult = {
  formulaVersion: string;
  countryCode: DutyCountryCode;
  inputs: DutyCalculationInput;
  stages: PipelineStageResult[];
  lineItems: CalculationLineItem[];
  summary: {
    fobGhs: number;
    freightGhs: number;
    insuranceGhs: number;
    cifGhs: number;
    customsValueGhs: number;
    totalGraTaxesGhs: number;
    totalPortChargesGhs: number;
    shippingLineChargesGhs: number;
    agentFeesGhs: number;
    totalLandedCostGhs: number;
    /** Sea/air transit estimate from shipping cost matrix (days). */
    estimatedTransitDays: number | null;
    /** Commercial purchase basis used for valuation. */
    pricingBasis?: "FOB" | "CFR" | "CIF" | "EXW" | "DDP" | "UNKNOWN";
    /** Σ unique payable duty lines — authoritative Total Estimated Duty Payable. */
    lineItemSumGhs?: number;
    /** |lineItemSum − engine total| before forcing total to line sum. */
    reconciliationDifferenceGhs?: number;
  };
  /** ISO timestamp when this estimate was produced. */
  calculatedAt: string;
  hsCode: string;
  hsCodeResolution: { code: string; description: string; method: string };
  exchangeRate: { rate: number; source: string; fromCurrency: string; effectiveDate: string };
  vehicleClassification: { category: DutyVehicleCategory | null; ageYears: number; commercial: boolean; profile: string };
  confidence: ConfidenceResult;
  historicalComparison: HistoricalComparison | null;
  predictionAdjustments: { category: string; factor: number; note: string }[];
  methodologyNote: string;
  ruleSetVersion?: string;
  profileId?: string;
  estimateRange?: EstimateRangeResult;
  explanation?: EstimateExplanation;
  vehicleSpec?: {
    source: string;
    confidence: string;
    inferredFields: Record<string, { value: string | number; source: string }>;
    needsConfirmation: string[];
  };
  calibration?: {
    cohortSize: number;
    exactFixtureMatch: boolean;
    valuationMethod: string;
    assumptions: string[];
  };
  cacheFingerprint?: string;
  engineReconciliation?: {
    lineTotal: number;
    documentedTotal: number;
    variance: number;
    withinTolerance: boolean;
    unexplainedVariance: boolean;
  } | null;
  /** Deduplicated payable duty lines (excludes FOB/freight/insurance/CIF). */
  payableDutyLines?: CalculationLineItem[];
};

export type DutyPipelineError = {
  code:
    | "CONFIG_UNAVAILABLE"
    | "MISSING_CLASSIFICATION"
    | "NEEDS_CLASSIFICATION"
    | "MISSING_RULE_SET"
    | "MISSING_FX_RATE"
    | "MISSING_CUSTOMS_VALUE"
    | "RULE_DEPENDENCY_ERROR"
    | "UNVERIFIED_RULE"
    | "ADMIN_REVIEW_REQUIRED"
    | "VALIDATION_ERROR"
    | "FREIGHT_REQUIRED"
    | "CALCULATION_RECONCILIATION_ERROR";
  message: string;
  adminHint?: string;
  health?: DutyConfigHealth;
  missingFields?: string[];
  details?: Record<string, unknown>;
};

export type LoadedFormulaRule = {
  id: string;
  code: string;
  label: string;
  basis: string;
  rateType: string;
  rateValue: number;
  conditionsJson: Record<string, unknown> | null;
  formulaNote: string | null;
  version: number;
  sortOrder: number;
};

export type LoadedChargeTemplate = {
  id: string;
  category: DutyChargeCategory;
  subcategory: string;
  label: string;
  amountGhs: number | null;
  calculationType: string;
  rateValue: number | null;
  shippingLineId: string | null;
  sampleCount: number;
};

export type LoadedHsCode = {
  hsCode: string;
  description: string;
  dutyRateHint: number | null;
};

export type CountryConfigBundle = {
  countryConfigId: string;
  countryCode: DutyCountryCode;
  currency: string;
  formulaRules: LoadedFormulaRule[];
  hsCodes: LoadedHsCode[];
  chargeTemplates: LoadedChargeTemplate[];
  calibrationFactors: Record<string, number>;
  shippingLines: { id: string; code: string; name: string }[];
};

export type SimilarImportMatch = {
  id: string;
  weight: number;
  manufacturer: string | null;
  model: string | null;
  year: number | null;
  totalLandedCostGhs: number | null;
  totalDutyGhs: number | null;
  portChargesGhs: number | null;
  shippingLineGhs: number | null;
  agentFeesGhs: number | null;
};

export type DutyShippingMethodType =
  | "CONTAINER"
  | "RORO"
  | "AIR_FREIGHT"
  | "SEA_FREIGHT";
export type DutyVehicleCategoryType = DutyVehicleCategory;
