import { z } from "zod";

import { DUTY_FORMULA_VERSION } from "./formula-version";

/** Matches Prisma `EngineType` — duplicated to avoid coupling this module to the ORM. */
export const DUTY_POWERTRAINS = ["GASOLINE", "ELECTRIC", "HYBRID", "PLUGIN_HYBRID"] as const;
export type DutyPowertrain = (typeof DUTY_POWERTRAINS)[number];

/**
 * Reference import-duty rate for battery-electric passenger cars under ECOWAS CET / HS 8703 electric
 * classifications (planning figure; GRA publishes bands in ICUMS — confirm CCVR).
 * @see https://www.trade.gov/market-intelligence/ghana-electrical-vehicle-tariffs
 */
export const GHANA_EV_PASSENGER_IMPORT_DUTY_REF = 0.2;

function gasolineAgeImportDutyRate(vehicleAgeYears: number): number {
  return vehicleAgeYears <= 5 ? 0.32 : vehicleAgeYears <= 10 ? 0.26 : 0.18;
}

/**
 * Illustrative import-duty rate on CIF for planning (not HS substitution).
 * - Gasoline: internal age bands (legacy UX).
 * - BEV: CET-style ~20% unless `applyEvDutyWaiver` models announced relief for qualifying imports.
 * - Hybrids: blend between gasoline band and BEV reference.
 */
export function resolveImportDutyRateForPowertrain(params: {
  powertrain: DutyPowertrain;
  vehicleAgeYears: number;
  applyEvDutyWaiver: boolean;
}): { rate: number; label: string } {
  const { powertrain, vehicleAgeYears, applyEvDutyWaiver } = params;
  const g = gasolineAgeImportDutyRate(vehicleAgeYears);

  if (powertrain === "ELECTRIC") {
    if (applyEvDutyWaiver) {
      return {
        rate: 0,
        label:
          "Modeled 0% import duty (announced EV relief may apply only to qualifying public-transport, assembly/SKD, or other GRA-approved categories — confirm in ICUMS).",
      };
    }
    return {
      rate: GHANA_EV_PASSENGER_IMPORT_DUTY_REF,
      label:
        `Reference ${(GHANA_EV_PASSENGER_IMPORT_DUTY_REF * 100).toFixed(0)}% on CIF — typical ECOWAS CET band for passenger BEV (HS 8703 electric). No engine cc; ICUMS uses VIN, CIF, and classification.`,
    };
  }

  if (powertrain === "HYBRID") {
    const rate = g * 0.72 + GHANA_EV_PASSENGER_IMPORT_DUTY_REF * 0.28;
    return {
      rate,
      label: `Blended ~${(rate * 100).toFixed(1)}% — hybrid (ICE + electric) often clears under ICE-oriented HS lines with partial electric propulsion; confirm exact code and rate in ICUMS.`,
    };
  }

  if (powertrain === "PLUGIN_HYBRID") {
    const rate = g * 0.48 + GHANA_EV_PASSENGER_IMPORT_DUTY_REF * 0.52;
    return {
      rate,
      label: `Blended ~${(rate * 100).toFixed(1)}% — plug-in hybrid; duty depends on HS treatment (often between full ICE and BEV). Verify with GRA / ICUMS.`,
    };
  }

  return {
    rate: g,
    label: `CIF × ${(g * 100).toFixed(0)}% — illustrative gasoline age band (~${vehicleAgeYears}y).`,
  };
}

function powertrainMethodologySuffix(powertrain: DutyPowertrain, applyEvDutyWaiver: boolean): string {
  if (powertrain === "ELECTRIC") {
    return [
      "Battery electric (BEV): no engine displacement — customs classification and duty are driven by HS code (e.g. 8703 electric), CIF, and age/overages in ICUMS.",
      applyEvDutyWaiver
        ? "Ghana has announced time-limited import duty relief for certain EV categories (e.g. public transport, registered assembly). Personal-use cars may still attract standard CET unless GRA confirms eligibility."
        : "Compare with the official ICUMS used-vehicle / valuation tools and GRA vehicle importation guidance before relying on this estimate.",
    ].join(" ");
  }
  if (powertrain === "HYBRID" || powertrain === "PLUGIN_HYBRID") {
    return "Hybrid / PHEV: ICUMS assessment may use ICE cylinder capacity, electric motor data, or combined classification — supply accurate technical data to your clearing agent.";
  }
  return "Gasoline / diesel-style ICE: where applicable, cylinder capacity and age still drive many published duty bands in GRA reference tables.";
}

/** Inputs for the in-app estimate (not a substitute for ICUMS CCVR). */
export const dutyEstimateInputSchema = z
  .object({
    /** Customs-relevant value in GHS (CIF-style declared value for estimation). */
    cifGhs: z.number().positive().max(500_000_000),
    vehicleYear: z.number().int().min(1980).max(new Date().getFullYear() + 1),
    engineCc: z.number().int().positive().max(30_000).optional(),
    powertrain: z.enum(DUTY_POWERTRAINS).default("GASOLINE"),
    /** Only applies when powertrain is ELECTRIC — models possible announced relief (see GRA / Finance policy). */
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
};

/**
 * Simplified Ghana import-style stacking for **planning estimates only**.
 * Rates are illustrative bands, not a substitute for HS classification, exemptions, ICUMS CCVR, or broker advice.
 */
export function computeDutyEstimate(input: DutyEstimateInput, referenceYear = new Date().getFullYear()): DutyEstimateResult {
  const cif = input.cifGhs;
  const age = Math.max(0, referenceYear - input.vehicleYear);

  const { rate: importDutyRate, label: importDutyLabel } = resolveImportDutyRateForPowertrain({
    powertrain: input.powertrain,
    vehicleAgeYears: age,
    applyEvDutyWaiver: input.applyEvDutyWaiver,
  });

  const importDuty = Math.round(cif * importDutyRate * 100) / 100;

  const ecowasLevy = Math.round(cif * 0.005 * 100) / 100;
  const edaLevy = Math.round(cif * 0.005 * 100) / 100;
  const otherLevies = Math.round(cif * 0.0175 * 100) / 100;

  const vatBase = cif + importDuty + ecowasLevy + edaLevy + otherLevies;
  const vat = Math.round(vatBase * 0.15 * 100) / 100;

  const ccNote =
    input.powertrain === "ELECTRIC"
      ? "Engine cc is not used for BEV — displacement is N/A."
      : input.engineCc != null
        ? `Engine ${input.engineCc} cc noted — illustrative only; ICUMS may use different capacity bands.`
        : input.powertrain === "GASOLINE"
          ? "Engine displacement not supplied — confirm classification and cc-based bands in ICUMS where applicable."
          : "Consider entering ICE cylinder capacity (if any) for closer ICE-side alignment; ICUMS still determines final treatment.";

  const lines: DutyEstimateLine[] = [
    {
      code: "IMPORT_DUTY",
      label:
        input.powertrain === "ELECTRIC" && input.applyEvDutyWaiver
          ? "Import duty (modeled exemption scenario)"
          : "Import duty (illustrative)",
      amountGhs: importDuty,
      basisNote: importDutyLabel,
    },
    {
      code: "ECOWAS",
      label: "ECOWAS levy (illustrative)",
      amountGhs: ecowasLevy,
      basisNote: "Illustrative 0.5% on CIF — confirm current rate in official sources.",
    },
    {
      code: "EDA",
      label: "Export Development / similar levy (illustrative)",
      amountGhs: edaLevy,
      basisNote: "Illustrative 0.5% on CIF — confirm with customs.",
    },
    {
      code: "OTHER_LEVIES",
      label: "Additional levies bundle (illustrative)",
      amountGhs: otherLevies,
      basisNote: "Placeholder bundle for GETFund/NHIL-style charges — replace with broker-verified stack when available.",
    },
    {
      code: "VAT",
      label: "VAT-style charge (illustrative)",
      amountGhs: vat,
      basisNote: "Illustrative 15% on (CIF + selected duties/levies) — actual VAT base differs per declaration.",
    },
  ];

  const totalGhs = Math.round(lines.reduce((s, l) => s + l.amountGhs, 0) * 100) / 100;

  return {
    formulaVersion: DUTY_FORMULA_VERSION,
    inputs: input,
    vehicleAgeYears: age,
    lines,
    totalGhs,
    methodologyNote: [
      ccNote,
      powertrainMethodologySuffix(input.powertrain, input.applyEvDutyWaiver),
      "This model is for Spark and Drive Autos internal planning and customer education only.",
      "Authoritative duty is computed in ICUMS (UniPass Ghana) from your declaration; use GRA vehicle importation guidance and a licensed clearing agent.",
    ].join(" "),
  };
}
