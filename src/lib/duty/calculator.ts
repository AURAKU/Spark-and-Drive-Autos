import { z } from "zod";

import { DUTY_FORMULA_VERSION } from "./formula-version";

/** Inputs for the in-app estimate (not ICUMS). */
export const dutyEstimateInputSchema = z.object({
  /** Customs-relevant value in GHS (CIF-style declared value for estimation). */
  cifGhs: z.number().positive().max(500_000_000),
  vehicleYear: z.number().int().min(1980).max(new Date().getFullYear() + 1),
  engineCc: z.number().int().positive().max(30_000).optional(),
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
 * Rates are illustrative bands, not a substitute for HS classification, exemptions, ICUMS, or broker advice.
 */
export function computeDutyEstimate(input: DutyEstimateInput, referenceYear = new Date().getFullYear()): DutyEstimateResult {
  const cif = input.cifGhs;
  const age = Math.max(0, referenceYear - input.vehicleYear);

  // Illustrative passenger-vehicle import duty band by age (not HS-specific).
  const importDutyRate = age <= 5 ? 0.32 : age <= 10 ? 0.26 : 0.18;
  const importDuty = Math.round(cif * importDutyRate * 100) / 100;

  // Common add-ons (simplified flat rates on CIF for UX transparency — real filing stacks levies per current law).
  const ecowasLevy = Math.round(cif * 0.005 * 100) / 100;
  const edaLevy = Math.round(cif * 0.005 * 100) / 100;
  const otherLevies = Math.round(cif * 0.0175 * 100) / 100;

  const vatBase = cif + importDuty + ecowasLevy + edaLevy + otherLevies;
  const vat = Math.round(vatBase * 0.15 * 100) / 100;

  const engineNote =
    input.engineCc != null
      ? `Engine ${input.engineCc} cc noted — this estimate does not apply HS engine-class adjustments.`
      : "Engine displacement not supplied — confirm classification in ICUMS.";

  const lines: DutyEstimateLine[] = [
    {
      code: "IMPORT_DUTY",
      label: "Import duty (illustrative age band)",
      amountGhs: importDuty,
      basisNote: `CIF × ${(importDutyRate * 100).toFixed(0)}% — vehicle age ~${age}y from ${referenceYear} reference.`,
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
      engineNote,
      "This model is for Spark and Drive Autos internal planning and customer education only.",
      "Use ICUMS and your licensed clearing agent for authoritative figures.",
    ].join(" "),
  };
}
