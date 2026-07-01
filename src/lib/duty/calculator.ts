import { EngineType } from "@prisma/client";
import { z } from "zod";

import { runDutyIntelligencePipeline } from "@/lib/duty-intelligence/pipeline";
import type { DutyCalculationInput } from "@/lib/duty-intelligence/types";

import { DUTY_FORMULA_VERSION } from "./formula-version";
import { engineTypeLabel } from "@/lib/engine-type-ui";

/** Aligned with Prisma `EngineType` (ICE split into petrol vs diesel for listings). */
export const DUTY_POWERTRAINS = [
  EngineType.GASOLINE_PETROL,
  EngineType.GASOLINE_DIESEL,
  EngineType.ELECTRIC,
  EngineType.HYBRID,
  EngineType.PLUGIN_HYBRID,
] as const;
export type DutyPowertrain = (typeof DUTY_POWERTRAINS)[number];

export const GHANA_EV_PASSENGER_IMPORT_DUTY_REF = 0.2;

/** @deprecated Use duty-intelligence pipeline — kept for reference in tests. */
export function resolveImportDutyRateForPowertrain(params: {
  powertrain: DutyPowertrain;
  vehicleAgeYears: number;
  applyEvDutyWaiver: boolean;
}): { rate: number; label: string } {
  const { powertrain, vehicleAgeYears, applyEvDutyWaiver } = params;
  const g = vehicleAgeYears <= 5 ? 0.32 : vehicleAgeYears <= 10 ? 0.26 : 0.18;

  if (powertrain === "ELECTRIC") {
    if (applyEvDutyWaiver) {
      return { rate: 0, label: "Modeled 0% import duty (EV relief scenario)." };
    }
    return { rate: GHANA_EV_PASSENGER_IMPORT_DUTY_REF, label: `Reference ${(GHANA_EV_PASSENGER_IMPORT_DUTY_REF * 100).toFixed(0)}% on CIF — BEV.` };
  }
  if (powertrain === "HYBRID") {
    const rate = g * 0.72 + GHANA_EV_PASSENGER_IMPORT_DUTY_REF * 0.28;
    return { rate, label: `Blended ~${(rate * 100).toFixed(1)}% — hybrid.` };
  }
  if (powertrain === "PLUGIN_HYBRID") {
    const rate = g * 0.48 + GHANA_EV_PASSENGER_IMPORT_DUTY_REF * 0.52;
    return { rate, label: `Blended ~${(rate * 100).toFixed(1)}% — PHEV.` };
  }
  return { rate: g, label: `CIF × ${(g * 100).toFixed(0)}% — ICE age band (~${vehicleAgeYears}y).` };
}

export const dutyEstimateInputSchema = z
  .object({
    cifGhs: z.number().positive().max(500_000_000),
    vehicleYear: z.number().int().min(1980).max(new Date().getFullYear() + 1),
    engineCc: z.number().int().positive().max(30_000).optional(),
    powertrain: z.nativeEnum(EngineType).default(EngineType.GASOLINE_PETROL),
    applyEvDutyWaiver: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.applyEvDutyWaiver && data.powertrain !== "ELECTRIC") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duty relief scenario applies to electric (BEV) only.",
        path: ["applyEvDutyWaiver"],
      });
    }
  });

export type DutyEstimateInput = z.infer<typeof dutyEstimateInputSchema>;

export type DutyEstimateLine = {
  code: string;
  label: string;
  amountGhs: number;
  basisNote: string;
};

export type DutyEstimateResult = {
  formulaVersion: typeof DUTY_FORMULA_VERSION;
  inputs: DutyEstimateInput;
  vehicleAgeYears: number;
  lines: DutyEstimateLine[];
  totalGhs: number;
  methodologyNote: string;
  /** Full intelligence result when available */
  intelligence?: Awaited<ReturnType<typeof runDutyIntelligencePipeline>>;
};

function toLegacyInput(input: DutyEstimateInput): DutyCalculationInput {
  return {
    countryCode: "GH",
    vehicle: {
      year: input.vehicleYear,
      fuelType: input.powertrain,
      engineCc: input.engineCc,
      applyEvDutyWaiver: input.applyEvDutyWaiver,
    },
    purchase: { fobAmount: input.cifGhs, fobCurrency: "GHS" },
    shipping: { shippingMethod: "SEA_FREIGHT", otherShippingChargesGhs: 0 },
    cifGhsOverride: input.cifGhs,
  };
}

/**
 * Ghana import duty estimate via the Duty Intelligence Engine.
 * All rates are loaded from configurable database rules — not hardcoded.
 */
export async function computeDutyEstimateAsync(
  input: DutyEstimateInput,
  referenceYear = new Date().getFullYear(),
): Promise<DutyEstimateResult> {
  const intelligence = await runDutyIntelligencePipeline(toLegacyInput(input), referenceYear);
  const age = Math.max(0, referenceYear - input.vehicleYear);

  const taxLines = intelligence.lineItems.filter((l: { category: string }) =>
    ["DUTY", "LEVY", "VAT", "FEE"].includes(l.category),
  );

  const lines: DutyEstimateLine[] = taxLines.map((l: { code: string; label: string; amountGhs: number; basis: string; formula: string }) => ({
    code: l.code,
    label: l.label,
    amountGhs: l.amountGhs,
    basisNote: `${l.basis} | ${l.formula}`,
  }));

  const ccNote =
    input.powertrain === "ELECTRIC"
      ? "Engine cc is not used for BEV."
      : input.engineCc != null
        ? `Engine ${input.engineCc} cc noted.`
        : "Engine displacement not supplied.";

  return {
    formulaVersion: DUTY_FORMULA_VERSION,
    inputs: input,
    vehicleAgeYears: age,
    lines,
    totalGhs: intelligence.summary.totalGraTaxesGhs,
    methodologyNote: [ccNote, engineTypeLabel(input.powertrain), intelligence.methodologyNote].join(" "),
    intelligence,
  };
}

/** Sync wrapper — uses pipeline; requires DB. For client components use computeDutyEstimateAsync via API. */
export function computeDutyEstimate(input: DutyEstimateInput, referenceYear = new Date().getFullYear()): DutyEstimateResult {
  const age = Math.max(0, referenceYear - input.vehicleYear);
  const { rate: importDutyRate, label: importDutyLabel } = resolveImportDutyRateForPowertrain({
    powertrain: input.powertrain,
    vehicleAgeYears: age,
    applyEvDutyWaiver: input.applyEvDutyWaiver,
  });

  const cif = input.cifGhs;
  const importDuty = Math.round(cif * importDutyRate * 100) / 100;
  const ecowasLevy = Math.round(cif * 0.005 * 100) / 100;
  const edaLevy = Math.round(cif * 0.005 * 100) / 100;
  const nhil = Math.round(cif * 0.025 * 100) / 100;
  const getfund = Math.round(cif * 0.025 * 100) / 100;
  const specialLevy = Math.round(cif * 0.01 * 100) / 100;
  const eximLevy = Math.round(cif * 0.0075 * 100) / 100;
  const auLevy = Math.round(cif * 0.002 * 100) / 100;
  const otherLevies = nhil + getfund + specialLevy + eximLevy + auLevy;
  const vatBase = cif + importDuty + ecowasLevy + edaLevy + otherLevies;
  const vat = Math.round(vatBase * 0.15 * 100) / 100;

  const lines: DutyEstimateLine[] = [
    { code: "IMPORT_DUTY", label: "Import duty", amountGhs: importDuty, basisNote: importDutyLabel },
    { code: "ECOWAS", label: "ECOWAS levy", amountGhs: ecowasLevy, basisNote: "0.5% on CIF" },
    { code: "EDA", label: "EDA levy", amountGhs: edaLevy, basisNote: "0.5% on CIF" },
    { code: "NHIL", label: "NHIL", amountGhs: nhil, basisNote: "2.5% on CIF" },
    { code: "GETFUND", label: "GETFund", amountGhs: getfund, basisNote: "2.5% on CIF" },
    { code: "SPECIAL_IMPORT_LEVY", label: "Special Import Levy", amountGhs: specialLevy, basisNote: "1% on CIF" },
    { code: "EXIM_LEVY", label: "EXIM Levy", amountGhs: eximLevy, basisNote: "0.75% on CIF" },
    { code: "AU_LEVY", label: "AU Levy", amountGhs: auLevy, basisNote: "0.2% on CIF" },
    { code: "VAT", label: "Import VAT", amountGhs: vat, basisNote: "15% on VAT base" },
  ];

  return {
    formulaVersion: DUTY_FORMULA_VERSION,
    inputs: input,
    vehicleAgeYears: age,
    lines,
    totalGhs: Math.round(lines.reduce((s, l) => s + l.amountGhs, 0) * 100) / 100,
    methodologyNote:
      "Sync fallback estimate — use the Duty Intelligence API for full landed cost with port, shipping, and agent charges.",
  };
}
