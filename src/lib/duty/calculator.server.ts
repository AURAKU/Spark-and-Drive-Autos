import "server-only";

import { isPipelineError, runDutyIntelligencePipeline } from "@/lib/duty-intelligence/pipeline";
import type { DutyCalculationInput, DutyIntelligenceResult } from "@/lib/duty-intelligence/types";

import { DUTY_FORMULA_VERSION } from "./formula-version";
import { engineTypeLabel } from "@/lib/engine-type-ui";

import {
  type DutyEstimateInput,
  type DutyEstimateLine,
  type DutyEstimateResult,
} from "./calculator";

function toLegacyInput(input: DutyEstimateInput): DutyCalculationInput {
  return {
    countryCode: "GH",
    vehicle: {
      manufacturer: "Unknown",
      model: "Vehicle",
      year: input.vehicleYear,
      countryOfOrigin: "CHINA",
      vehicleCategory: "SEDAN",
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
  const pipelineResult = await runDutyIntelligencePipeline(toLegacyInput(input), referenceYear);
  if (isPipelineError(pipelineResult)) {
    throw new Error(`${pipelineResult.code}: ${pipelineResult.message}`);
  }
  const intelligence = pipelineResult;
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

export type { DutyIntelligenceResult };
