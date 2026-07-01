import type {
  DutyChargeCategory,
  DutyCountryCode,
  DutyVehicleCategory,
} from "@prisma/client";
import { EngineType as EngineTypeEnum } from "@prisma/client";
import { z } from "zod";

export const dutyVehicleInputSchema = z.object({
  manufacturer: z.string().trim().min(1).max(120).optional(),
  model: z.string().trim().min(1).max(120).optional(),
  trim: z.string().trim().max(120).optional(),
  year: z.number().int().min(1980).max(new Date().getFullYear() + 1),
  vin: z.string().trim().max(32).optional(),
  chassis: z.string().trim().max(64).optional(),
  countryOfOrigin: z.string().trim().max(80).optional(),
  vehicleCategory: z.nativeEnum({
    SUV: "SUV",
    SEDAN: "SEDAN",
    PICKUP: "PICKUP",
    TRUCK: "TRUCK",
    BUS: "BUS",
    VAN: "VAN",
  } as const satisfies Record<DutyVehicleCategory, DutyVehicleCategory>).optional(),
  fuelType: z.nativeEnum(EngineTypeEnum).default(EngineTypeEnum.GASOLINE_PETROL),
  engineCc: z.number().int().positive().max(30_000).optional(),
  batteryKwh: z.number().positive().max(500).optional(),
  horsepower: z.number().int().positive().max(5000).optional(),
  grossWeightKg: z.number().int().positive().max(100_000).optional(),
  seatingCapacity: z.number().int().positive().max(80).optional(),
  transmission: z.string().trim().max(40).optional(),
  driveType: z.string().trim().max(40).optional(),
  isCommercial: z.boolean().optional(),
  applyEvDutyWaiver: z.boolean().default(false),
});

export const dutyPurchaseInputSchema = z.object({
  fobAmount: z.number().nonnegative(),
  fobCurrency: z.string().trim().length(3).default("USD"),
  supplier: z.string().trim().max(160).optional(),
  supplierCountry: z.string().trim().max(80).optional(),
  purchaseDate: z.string().datetime().optional(),
  invoiceNumber: z.string().trim().max(80).optional(),
});

export const dutyShippingInputSchema = z.object({
  shippingMethod: z.nativeEnum({
    CONTAINER: "CONTAINER",
    RORO: "RORO",
    AIR_FREIGHT: "AIR_FREIGHT",
    SEA_FREIGHT: "SEA_FREIGHT",
  } as const).default("SEA_FREIGHT"),
  shippingLineCode: z.string().trim().max(32).optional(),
  portOfLoading: z.string().trim().max(120).optional(),
  destinationPort: z.string().trim().max(120).optional(),
  freightGhs: z.number().nonnegative().optional(),
  insuranceGhs: z.number().nonnegative().optional(),
  otherShippingChargesGhs: z.number().nonnegative().default(0),
  containerType: z.string().trim().max(40).optional(),
  containerNumber: z.string().trim().max(40).optional(),
});

export const dutyCalculationInputSchema = z.object({
  countryCode: z.nativeEnum({ GH: "GH" } as const).default("GH"),
  vehicle: dutyVehicleInputSchema,
  purchase: dutyPurchaseInputSchema,
  shipping: dutyShippingInputSchema,
  /** Direct CIF override in GHS — skips FOB conversion when set. */
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

export type ConfidenceResult = {
  score: number;
  label: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  similarImportCount: number;
  basisNote: string;
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
  };
  hsCode: string;
  hsCodeResolution: { code: string; description: string; method: string };
  exchangeRate: { rate: number; source: string; fromCurrency: string; effectiveDate: string };
  vehicleClassification: { category: DutyVehicleCategory | null; ageYears: number; commercial: boolean };
  confidence: ConfidenceResult;
  predictionAdjustments: { category: string; factor: number; note: string }[];
  methodologyNote: string;
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
