import { money, moneyToNumber } from "./money";
import { weightedAverage } from "./prediction";
import type { CohortRecord } from "./cohort-matcher";
import { isExactVerifiedCohort } from "./cohort-matcher";

export type ValuationEstimate = {
  customsValueGhs?: number;
  freightGhs?: number;
  insuranceGhs?: number;
  method: "EXACT_COHORT" | "MEDIAN_RATIO" | "TRIMMED_MEAN" | "CONFIGURED" | "NONE";
  cohortSize: number;
  note: string;
};

export type CalibrationAdjustment = {
  category: string;
  factor: number;
  sampleCount: number;
  method: "EXACT_COHORT" | "MEDIAN_RATIO" | "TRIMMED_MEAN" | "NONE";
  note: string;
  appliedTo: "VALUATION_ONLY" | "ANCILLARY_ESTIMATE" | "CONFIDENCE";
};

export type CalibrationLayerResult = {
  valuation: ValuationEstimate;
  adjustments: CalibrationAdjustment[];
  expectedVariancePct: number;
  cohortSize: number;
  exactFixtureMatch: boolean;
  assumptions: string[];
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function trimmedMean(values: number[], trimPct = 0.1): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * trimPct);
  const slice = sorted.slice(trim, sorted.length - trim || undefined);
  if (slice.length === 0) return median(sorted);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

function ratioMedian(numerator: number[], denominator: number[]): number | null {
  const ratios: number[] = [];
  for (let i = 0; i < Math.min(numerator.length, denominator.length); i++) {
    const d = denominator[i]!;
    if (d > 0) ratios.push(numerator[i]! / d);
  }
  return median(ratios);
}

export function runCalibrationLayer(params: {
  cohort: CohortRecord[];
  fobGhs: number;
  configuredFreightGhs?: number;
  configuredInsuranceGhs?: number;
  configuredCustomsValueGhs?: number;
  minimumSampleThreshold?: number;
}): CalibrationLayerResult {
  const threshold = params.minimumSampleThreshold ?? 3;
  const exact = params.cohort.find(isExactVerifiedCohort);
  const assumptions: string[] = [];

  if (exact) {
    assumptions.push(`Exact verified cohort match: ${exact.make} ${exact.model}`);
    return {
      valuation: {
        customsValueGhs: exact.customsValueGhs ?? params.configuredCustomsValueGhs,
        freightGhs: exact.freightGhs ?? params.configuredFreightGhs,
        insuranceGhs: exact.insuranceGhs ?? params.configuredInsuranceGhs,
        method: "EXACT_COHORT",
        cohortSize: 1,
        note: "Using verified Bill of Entry fixture values for this exact make/model profile.",
      },
      adjustments: [],
      expectedVariancePct: 0,
      cohortSize: 1,
      exactFixtureMatch: true,
      assumptions,
    };
  }

  const cohortSize = params.cohort.length;
  assumptions.push(`Historical cohort size: ${cohortSize}`);

  if (cohortSize === 0) {
    return {
      valuation: {
        method: "CONFIGURED",
        cohortSize: 0,
        note: "No matching historical cohort — using configured freight/insurance and declared FOB.",
      },
      adjustments: [],
      expectedVariancePct: 12,
      cohortSize: 0,
      exactFixtureMatch: false,
      assumptions: [...assumptions, "No similar verified imports matched"],
    };
  }

  const freightRatios = params.cohort
    .filter((c) => c.freightGhs != null && c.fobGhs != null && c.fobGhs > 0)
    .map((c) => c.freightGhs! / c.fobGhs!);
  const insuranceRatios = params.cohort
    .filter((c) => c.insuranceGhs != null && c.fobGhs != null && c.fobGhs > 0)
    .map((c) => c.insuranceGhs! / c.fobGhs!);
  const customsRatios = params.cohort
    .filter((c) => c.customsValueGhs != null && c.fobGhs != null && c.fobGhs > 0)
    .map((c) => c.customsValueGhs! / c.fobGhs!);

  const method = cohortSize >= threshold ? "TRIMMED_MEAN" : "MEDIAN_RATIO";
  assumptions.push(cohortSize >= threshold ? "Trimmed mean ratios from matched cohort" : "Median ratios from small cohort (below minimum sample threshold)");

  let freightGhs = params.configuredFreightGhs;
  let insuranceGhs = params.configuredInsuranceGhs;
  let customsValueGhs = params.configuredCustomsValueGhs;

  const freightRatio = method === "TRIMMED_MEAN" ? trimmedMean(freightRatios) : median(freightRatios);
  if (freightRatio != null && params.fobGhs > 0) {
    freightGhs = moneyToNumber(money(params.fobGhs).times(freightRatio));
    assumptions.push(`Freight estimated from cohort ${method === "TRIMMED_MEAN" ? "trimmed mean" : "median"} FOB ratio`);
  }

  const insuranceRatio = method === "TRIMMED_MEAN" ? trimmedMean(insuranceRatios) : median(insuranceRatios);
  if (insuranceRatio != null && params.fobGhs > 0) {
    insuranceGhs = moneyToNumber(money(params.fobGhs).times(insuranceRatio));
    assumptions.push(`Insurance estimated from cohort ratio`);
  }

  const customsRatio = method === "TRIMMED_MEAN" ? trimmedMean(customsRatios) : median(customsRatios);
  if (customsRatio != null && params.fobGhs > 0 && !params.configuredCustomsValueGhs) {
    customsValueGhs = moneyToNumber(money(params.fobGhs).times(customsRatio));
    assumptions.push(`Customs value hint from cohort median CIF/FOB relationship`);
  }

  const dutyValues = params.cohort.map((c) => c.totalDutyGhs).filter((v): v is number => v != null && v > 0);
  const dutyMedian = median(dutyValues);
  const adjustments: CalibrationAdjustment[] = [];

  if (dutyMedian != null && cohortSize >= 1) {
    adjustments.push({
      category: "TOTAL_DUTY_REFERENCE",
      factor: 1,
      sampleCount: cohortSize,
      method: cohortSize >= threshold ? "TRIMMED_MEAN" : "MEDIAN_RATIO",
      note: `Cohort median duty reference GHS ${Math.round(dutyMedian).toLocaleString()} — not applied to deterministic tax lines.`,
      appliedTo: "CONFIDENCE",
    });
  }

  const weightedDuty = weightedAverage(
    params.cohort
      .filter((c) => c.totalDutyGhs != null && c.matchScore > 0)
      .map((c) => ({ value: c.totalDutyGhs!, weight: c.matchScore })),
  );

  if (weightedDuty != null) {
    adjustments.push({
      category: "WEIGHTED_DUTY_BENCHMARK",
      factor: 1,
      sampleCount: cohortSize,
      method: "MEDIAN_RATIO",
      note: `Weighted cohort duty benchmark GHS ${weightedDuty.toLocaleString()} for confidence calibration only.`,
      appliedTo: "CONFIDENCE",
    });
  }

  const variancePct = cohortSize >= threshold ? 5 : cohortSize >= 1 ? 8 : 12;

  return {
    valuation: {
      customsValueGhs,
      freightGhs,
      insuranceGhs,
      method: cohortSize >= threshold ? "TRIMMED_MEAN" : "MEDIAN_RATIO",
      cohortSize,
      note:
        cohortSize < threshold
          ? `Only ${cohortSize} similar case(s) available — insufficient for generalized model accuracy claims.`
          : `${cohortSize} similar cases used for valuation hints.`,
    },
    adjustments,
    expectedVariancePct: variancePct,
    cohortSize,
    exactFixtureMatch: false,
    assumptions,
  };
}
