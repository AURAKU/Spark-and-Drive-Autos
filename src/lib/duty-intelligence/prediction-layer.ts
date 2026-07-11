import type { CalibrationLayerResult } from "./calibration-engine";
import { runCalibrationLayer } from "./calibration-engine";
import { matchCohort, type CohortRecord } from "./cohort-matcher";
import { buildEstimateExplanation, sanitizeExplanationForCustomer } from "./explanation";
import { evaluateCalibrationFixtures, computeEvaluationMetrics } from "./evaluation-metrics";
import { buildEstimateRange, buildLandedCostRange } from "./range";
import { computeCalibratedConfidence, buildHistoricalComparison } from "./confidence";
import type { DutyCalculationInput, DutyIntelligenceResult, EstimateRangeResult } from "./types";

export type PredictionLayerInput = {
  countryConfigId: string;
  input: DutyCalculationInput;
  hsCode: string;
  hsCodeNormalized: string;
  profileId: string;
  profileDescription: string;
  ruleSetVersion: string;
  verifiedProfile: boolean;
  hsResolutionMethod: string;
  fobGhs: number;
  freightGhs: number;
  insuranceGhs: number;
  customsValueGhs: number;
  cifGhs: number;
  totalDutyGhs: number;
  totalLandedCostGhs: number;
  fxRate: number;
  fxSource: string;
  fxEffectiveDate: string;
  assessmentDate: Date;
  vehicleDataComplete: boolean;
  similarImports: Awaited<ReturnType<typeof import("./prediction").findSimilarImports>>;
};

export type PredictionLayerResult = {
  cohort: CohortRecord[];
  calibration: CalibrationLayerResult;
  confidence: ReturnType<typeof computeCalibratedConfidence>;
  historicalComparison: ReturnType<typeof buildHistoricalComparison>;
  estimateRange: EstimateRangeResult;
  explanation: ReturnType<typeof sanitizeExplanationForCustomer>;
  predictionAdjustments: { category: string; factor: number; note: string }[];
};

const evaluationMetrics = computeEvaluationMetrics(evaluateCalibrationFixtures());

export async function runPredictionLayer(params: PredictionLayerInput): Promise<PredictionLayerResult> {
  const cohort = await matchCohort({
    countryConfigId: params.countryConfigId,
    make: params.input.vehicle.manufacturer,
    model: params.input.vehicle.model,
    year: params.input.vehicle.year,
    fuelType: mapFuel(params.input.vehicle.fuelType),
    hsCode: params.hsCodeNormalized,
    vehicleCategory: params.input.vehicle.vehicleCategory,
    engineCc: params.input.vehicle.engineCc,
    assessmentDate: params.assessmentDate,
    countryOfOrigin: params.input.vehicle.countryOfOrigin,
    excludeSplits: ["HOLDOUT"],
  });

  const calibration = runCalibrationLayer({
    cohort,
    fobGhs: params.fobGhs,
    configuredFreightGhs: params.freightGhs,
    configuredInsuranceGhs: params.insuranceGhs,
    configuredCustomsValueGhs: params.customsValueGhs,
  });

  const hsCertainty =
    params.hsResolutionMethod === "EXACT_HS" || params.hsResolutionMethod === "ADMIN_OVERRIDE"
      ? "EXACT"
      : params.hsResolutionMethod === "HEADING_FUEL"
        ? "HEADING"
        : "INFERRED";

  const confidence = computeCalibratedConfidence({
    verifiedProfile: params.verifiedProfile,
    profileId: params.profileId,
    hsCertainty,
    vehicleDataComplete: params.vehicleDataComplete,
    customsValueCertainty: params.input.cifGhsOverride ? "DECLARED" : "CONFIGURED",
    fxRateCertainty: params.input.exchangeRateOverride ? "CONFIGURED" : "ASSESSMENT_DATE",
    ruleVerificationStatus: params.verifiedProfile ? "VERIFIED" : "UNVERIFIED",
    cohort,
    calibration,
    evaluationMetrics,
    similarImports: params.similarImports,
    input: params.input,
  });

  const dutyRange = buildEstimateRange({
    baseGhs: params.totalDutyGhs,
    verifiedProfile: params.verifiedProfile && calibration.exactFixtureMatch,
    confidenceLevel: confidence.level,
    calibration,
  });

  const landedRange = buildLandedCostRange({
    customsValueGhs: params.customsValueGhs,
    dutyRange,
  });

  const estimateRange: EstimateRangeResult = {
    ...dutyRange,
    landedCostLowGhs: landedRange.lowGhs,
    landedCostExpectedGhs: landedRange.expectedGhs,
    landedCostHighGhs: landedRange.highGhs,
  };

  const explanation = sanitizeExplanationForCustomer(
    buildEstimateExplanation({
      profileId: params.profileId,
      profileDescription: params.profileDescription,
      hsCode: params.hsCodeNormalized,
      confidenceLevel: confidence.level,
      estimateRange,
      calibration,
      cohort,
      customsValueMethod: params.input.cifGhsOverride
        ? "Customer-declared CIF override"
        : "FOB + configured/estimated freight + insurance (CIF basis)",
      fxRateUsed: params.fxRate,
      fxSource: params.fxSource,
      effectiveRuleDate: params.assessmentDate.toISOString().slice(0, 10),
      assumptions: calibration.assumptions,
    }),
  );

  const historicalComparison = buildHistoricalComparison({
    similarImports: params.similarImports,
    estimatedDutyGhs: params.totalDutyGhs,
    cohort,
  });

  const predictionAdjustments = calibration.adjustments.map((a) => ({
    category: a.category,
    factor: a.factor,
    note: a.note,
  }));

  return {
    cohort,
    calibration,
    confidence,
    historicalComparison,
    estimateRange,
    explanation,
    predictionAdjustments,
  };
}

function mapFuel(fuelType: string): string {
  if (fuelType === "GASOLINE_PETROL") return "GASOLINE";
  if (fuelType === "GASOLINE_DIESEL") return "DIESEL";
  return fuelType;
}

export function mergePredictionIntoResult(
  base: DutyIntelligenceResult,
  prediction: PredictionLayerResult,
  extras?: { cacheFingerprint?: string; vehicleSpec?: DutyIntelligenceResult["vehicleSpec"] },
): DutyIntelligenceResult {
  return {
    ...base,
    confidence: prediction.confidence,
    historicalComparison: prediction.historicalComparison,
    predictionAdjustments: prediction.predictionAdjustments,
    estimateRange: prediction.estimateRange,
    explanation: prediction.explanation,
    vehicleSpec: extras?.vehicleSpec,
    calibration: {
      cohortSize: prediction.calibration.cohortSize,
      exactFixtureMatch: prediction.calibration.exactFixtureMatch,
      valuationMethod: prediction.calibration.valuation.method,
      assumptions: prediction.calibration.assumptions,
    },
    cacheFingerprint: extras?.cacheFingerprint,
  };
}
