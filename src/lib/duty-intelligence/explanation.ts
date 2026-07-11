import type { CalibrationLayerResult } from "./calibration-engine";
import type { CohortRecord } from "./cohort-matcher";
import type { EvaluationMetrics } from "./evaluation-metrics";
import type { EstimateRange } from "./range";
import type { DutyConfidenceLevel, EstimateExplanation } from "./types";

export function buildEstimateExplanation(params: {
  profileId?: string;
  profileDescription?: string;
  hsCode: string;
  confidenceLevel: DutyConfidenceLevel;
  estimateRange: EstimateRange;
  calibration: CalibrationLayerResult;
  cohort: CohortRecord[];
  customsValueMethod: string;
  fxRateUsed: number;
  fxSource: string;
  effectiveRuleDate: string;
  assumptions: string[];
}): EstimateExplanation {
  const uncertaintyReasons: string[] = [];
  const assumptions = [...params.assumptions, ...params.calibration.assumptions];

  if (params.confidenceLevel === "LIMITED_EVIDENCE") {
    uncertaintyReasons.push("Limited verified import history for this vehicle profile");
  }
  if (params.confidenceLevel === "ADMIN_REVIEW_REQUIRED") {
    uncertaintyReasons.push("Classification or rule data requires admin review before relying on the total");
  }
  if (params.calibration.cohortSize < 3) {
    uncertaintyReasons.push(`Only ${params.calibration.cohortSize} similar verified case(s) — range reflects estimation uncertainty`);
  }
  if (params.estimateRange.bandPct > 0) {
    uncertaintyReasons.push(`Estimate band ±${Math.round(params.estimateRange.bandPct * 100)}% based on cohort variance and data completeness`);
  }

  const profileSummary = params.profileId
    ? `Vehicle profile ${params.profileId} (${params.profileDescription ?? params.hsCode})`
    : `HS classification ${params.hsCode}`;

  const majorAssumptions: string[] = [];
  if (params.customsValueMethod) majorAssumptions.push(`Customs value: ${params.customsValueMethod}`);
  majorAssumptions.push(`FX: 1 USD = ${params.fxRateUsed} GHS (${params.fxSource})`);
  majorAssumptions.push(`Rule set effective ${params.effectiveRuleDate}`);

  if (params.calibration.exactFixtureMatch) {
    majorAssumptions.push("Exact verified Bill of Entry fixture matched for this make/model");
  } else if (params.calibration.cohortSize > 0) {
    majorAssumptions.push(`${params.calibration.cohortSize} similar verified import(s) informed valuation assumptions`);
  }

  const whyRangeShown =
    params.estimateRange.bandPct === 0
      ? "Exact verified profile — deterministic rule set reproduced verified assessment lines."
      : "A range is shown because customs valuation, ancillary fees, or classification may differ from similar cases.";

  const couldChange = [
    "Final Ghana Customs/ICUMS assessed value at clearance",
    "Exchange rate on assessment date",
    "HS classification if vehicle specifications differ",
    "Additional port, shipping, or agent charges not in this estimate",
  ];

  return {
    profileUsed: profileSummary,
    majorAssumptions,
    whyRangeShown,
    couldChangeFinalAmount: couldChange,
    uncertaintyReasons,
    effectiveRuleDate: params.effectiveRuleDate,
    fxRateUsed: params.fxRateUsed,
    fxSource: params.fxSource,
    customsValueMethod: params.customsValueMethod,
    cohortSize: params.calibration.cohortSize,
    exactFixtureMatch: params.calibration.exactFixtureMatch,
  };
}

export function sanitizeExplanationForCustomer(explanation: EstimateExplanation): EstimateExplanation {
  return {
    ...explanation,
    majorAssumptions: explanation.majorAssumptions.filter((a) => !a.includes("fixture")),
    uncertaintyReasons: explanation.uncertaintyReasons.map((r) =>
      r.replace(/fixture/gi, "verified reference case"),
    ),
  };
}
