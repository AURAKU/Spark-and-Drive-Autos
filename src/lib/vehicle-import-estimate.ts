import { EngineType } from "@prisma/client";
import { z } from "zod";

export const VEHICLE_IMPORT_ESTIMATE_NOTICE =
  "Important Notice: This document is an estimate only. Final duty and related import charges are determined by Ghana Customs and ICUMS at clearance.";

export type DutyEstimateMode = "MANUAL" | "FORMULA" | "HYBRID";
export const vehicleImportEstimateStatusSchema = z.enum(["DRAFT", "SENT", "ACCEPTED", "EXPIRED", "SUPERSEDED"]);
export type VehicleImportEstimateStatusValue = z.infer<typeof vehicleImportEstimateStatusSchema>;

const allowedTransitions: Record<VehicleImportEstimateStatusValue, VehicleImportEstimateStatusValue[]> = {
  DRAFT: ["DRAFT", "SENT", "EXPIRED", "SUPERSEDED"],
  SENT: ["SENT", "ACCEPTED", "EXPIRED", "SUPERSEDED"],
  ACCEPTED: ["ACCEPTED", "SUPERSEDED"],
  EXPIRED: ["EXPIRED", "SUPERSEDED"],
  SUPERSEDED: ["SUPERSEDED"],
};

export const vehicleImportEstimateTransitionSchema = z
  .object({
    from: vehicleImportEstimateStatusSchema,
    to: vehicleImportEstimateStatusSchema,
  })
  .superRefine((value, ctx) => {
    if (!allowedTransitions[value.from].includes(value.to)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid transition from ${value.from} to ${value.to}.`,
        path: ["to"],
      });
    }
  });

type DutyLogicInput = {
  fob?: number;
  freight?: number;
  insurance?: number;
  cif?: number;
  estimatedDutyRangeMin?: number;
  estimatedDutyRangeMax?: number;
  estimatedLandedCost?: number;
  /** When set, scales formula duty range for BEV vs hybrid vs gasoline planning. */
  engineType?: EngineType;
};

export type DutyLogicResult = {
  cif?: number;
  estimatedDutyRangeMin?: number;
  estimatedDutyRangeMax?: number;
  estimatedLandedCost?: number;
  mode: DutyEstimateMode;
  uncertaintyNote: string;
  landedCostDerived: boolean;
};

const DEFAULT_DUTY_RATE_MIN = 0.28;
const DEFAULT_DUTY_RATE_MAX = 0.46;

function dutyRangeScaleForEngineType(engineType?: EngineType): { min: number; max: number } {
  switch (engineType) {
    case "ELECTRIC":
      return { min: 0.72, max: 0.76 };
    case "HYBRID":
      return { min: 0.9, max: 0.93 };
    case "PLUGIN_HYBRID":
      return { min: 0.84, max: 0.88 };
    default:
      return { min: 1, max: 1 };
  }
}

export const vehicleImportEstimateSchema = z.object({
  clientName: z.string().trim().min(2).max(160),
  clientContact: z.string().trim().min(3).max(200),
  vehicleName: z.string().trim().min(2).max(200),
  engineType: z.nativeEnum(EngineType).optional(),
  modelYear: z.coerce.number().int().min(1900).max(2100).optional(),
  vin: z
    .string()
    .trim()
    .max(64)
    .regex(/^[A-HJ-NPR-Z0-9-]{6,64}$/i, "VIN must use letters/numbers only and be at least 6 characters.")
    .optional(),
  fob: z.coerce.number().nonnegative().max(1_000_000_000).optional(),
  freight: z.coerce.number().nonnegative().max(1_000_000_000).optional(),
  insurance: z.coerce.number().nonnegative().max(1_000_000_000).optional(),
  cif: z.coerce.number().nonnegative().max(1_000_000_000).optional(),
  estimatedDutyRangeMin: z.coerce.number().nonnegative().max(1_000_000_000).optional(),
  estimatedDutyRangeMax: z.coerce.number().nonnegative().max(1_000_000_000).optional(),
  estimatedLandedCost: z.coerce.number().nonnegative().max(1_000_000_000).optional(),
  importantNotice: z.string().trim().max(4000).optional(),
  preparedByName: z.string().trim().min(2).max(140).optional(),
  customerId: z.string().cuid().optional(),
  orderId: z.string().cuid().optional(),
  inquiryId: z.string().cuid().optional(),
  carId: z.string().cuid().optional(),
}).superRefine((data, ctx) => {
  if (
    data.estimatedDutyRangeMin != null &&
    data.estimatedDutyRangeMax != null &&
    data.estimatedDutyRangeMax < data.estimatedDutyRangeMin
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["estimatedDutyRangeMax"],
      message: "Duty range max cannot be lower than min.",
    });
  }
  if (data.modelYear != null && data.modelYear > new Date().getFullYear() + 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["modelYear"],
      message: "Model year looks too far in the future.",
    });
  }
});

export function parseOptionalNumber(input: FormDataEntryValue | null): number | undefined {
  if (typeof input !== "string" || input.trim() === "") return undefined;
  const asNum = Number(input);
  if (!Number.isFinite(asNum)) return undefined;
  return asNum;
}

export function parseOptionalString(input: FormDataEntryValue | null): string | undefined {
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseOptionalEngineType(input: FormDataEntryValue | null): EngineType | undefined {
  if (typeof input !== "string" || input.trim() === "") return undefined;
  const v = input.trim();
  return (Object.values(EngineType) as string[]).includes(v) ? (v as EngineType) : undefined;
}

export function buildEstimateNumber(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const stamp = `${y}${m}${d}`;
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `SDA-VIOE-${stamp}-${suffix}`;
}

export function buildVehicleImportEstimateInput(formData: FormData) {
  const fob = parseOptionalNumber(formData.get("fob"));
  const freight = parseOptionalNumber(formData.get("freight"));
  const insurance = parseOptionalNumber(formData.get("insurance"));
  const cifInput = parseOptionalNumber(formData.get("cif"));
  const cif = cifInput ?? (fob != null && freight != null && insurance != null ? fob + freight + insurance : undefined);

  return {
    clientName: parseOptionalString(formData.get("clientName")),
    clientContact: parseOptionalString(formData.get("clientContact")),
    vehicleName: parseOptionalString(formData.get("vehicleName")),
    engineType: parseOptionalEngineType(formData.get("engineType")),
    modelYear: parseOptionalNumber(formData.get("modelYear")),
    vin: parseOptionalString(formData.get("vin")),
    fob,
    freight,
    insurance,
    cif,
    estimatedDutyRangeMin: parseOptionalNumber(formData.get("estimatedDutyRangeMin")),
    estimatedDutyRangeMax: parseOptionalNumber(formData.get("estimatedDutyRangeMax")),
    estimatedLandedCost: parseOptionalNumber(formData.get("estimatedLandedCost")),
    importantNotice: parseOptionalString(formData.get("importantNotice")),
    preparedByName: parseOptionalString(formData.get("preparedByName")),
    customerId: parseOptionalString(formData.get("customerId")),
    orderId: parseOptionalString(formData.get("orderId")),
    inquiryId: parseOptionalString(formData.get("inquiryId")),
    carId: parseOptionalString(formData.get("carId")),
  };
}

/**
 * Duty estimate logic layer:
 * - manual: admin provides duty range directly
 * - formula: duty range derived from CIF with conservative configurable rates
 * - hybrid: one duty boundary given manually, other boundary derived from CIF
 *
 * Landed cost is derived when admin does not manually set it.
 */
export function deriveDutyEstimate(input: DutyLogicInput): DutyLogicResult {
  const cif =
    input.cif ?? (input.fob != null && input.freight != null && input.insurance != null ? input.fob + input.freight + input.insurance : undefined);

  const manualMin = input.estimatedDutyRangeMin;
  const manualMax = input.estimatedDutyRangeMax;
  const hasManualMin = manualMin != null;
  const hasManualMax = manualMax != null;
  const hasAnyManualDuty = hasManualMin || hasManualMax;

  let mode: DutyEstimateMode = "MANUAL";
  let min = manualMin;
  let max = manualMax;

  const scale = dutyRangeScaleForEngineType(input.engineType);
  const effMinRate = DEFAULT_DUTY_RATE_MIN * scale.min;
  const effMaxRate = DEFAULT_DUTY_RATE_MAX * scale.max;

  if (!hasAnyManualDuty && cif != null) {
    mode = "FORMULA";
    min = Number((cif * effMinRate).toFixed(2));
    max = Number((cif * effMaxRate).toFixed(2));
  } else if (hasAnyManualDuty && cif != null && (!hasManualMin || !hasManualMax)) {
    mode = "HYBRID";
    if (!hasManualMin) min = Number((cif * effMinRate).toFixed(2));
    if (!hasManualMax) max = Number((cif * effMaxRate).toFixed(2));
  } else if (hasAnyManualDuty) {
    mode = "MANUAL";
  } else {
    mode = "MANUAL";
  }

  if (min != null && max != null && max < min) {
    const correctedMax = min;
    max = correctedMax;
  }

  const landedCostProvided = input.estimatedLandedCost != null;
  const landedCostDerived =
    !landedCostProvided && cif != null && min != null && max != null
      ? Number((cif + (min + max) / 2).toFixed(2))
      : input.estimatedLandedCost;

  const powertrainHint =
    input.engineType === "ELECTRIC"
      ? " Powertrain: BEV — ICUMS uses electric HS classification (no engine cc); announced duty relief may apply only to eligible categories."
      : input.engineType === "HYBRID" || input.engineType === "PLUGIN_HYBRID"
        ? " Powertrain: hybrid / PHEV — confirm combined ICE/electric HS treatment and rates in ICUMS."
        : "";

  const uncertaintyNote =
    (mode === "MANUAL"
      ? "Manual admin estimate. Verify against Ghana Customs / ICUMS assessment on arrival."
      : mode === "FORMULA"
        ? "Formula-driven planning range using CIF-based duty assumptions. Treat as directional only until official customs assessment."
        : "Hybrid estimate: manual + formula-derived values combined for planning. Final payable duty remains customs-determined.") + powertrainHint;

  return {
    cif,
    estimatedDutyRangeMin: min,
    estimatedDutyRangeMax: max,
    estimatedLandedCost: landedCostDerived,
    mode,
    uncertaintyNote,
    landedCostDerived: !landedCostProvided && landedCostDerived != null,
  };
}
