import { money, moneyToNumber } from "./money";
import type { CalibrationLayerResult } from "./calibration-engine";
import type { CohortRecord } from "./cohort-matcher";
import type { EvaluationMetrics } from "./evaluation-metrics";
import type {
  ConfidenceResult,
  DutyCalculationInput,
  DutyConfidenceLevel,
  HistoricalComparison,
  SimilarImportMatch,
} from "./types";

export type ConfidenceInput = {
  verifiedProfile: boolean;
  profileId?: string;
  hsCertainty: "EXACT" | "HEADING" | "INFERRED" | "UNKNOWN";
  vehicleDataComplete: boolean;
  customsValueCertainty: "DECLARED" | "CONFIGURED" | "COHORT_HINT" | "UNKNOWN";
  fxRateCertainty: "ASSESSMENT_DATE" | "CONFIGURED" | "DERIVED" | "UNKNOWN";
  ruleVerificationStatus: "VERIFIED" | "UNVERIFIED";
  cohort: CohortRecord[];
  calibration: CalibrationLayerResult;
  evaluationMetrics?: EvaluationMetrics;
  similarImports: SimilarImportMatch[];
  needsAdminReview?: boolean;
  input?: DutyCalculationInput;
};

function clampScore(score: number): number {
  return Math.min(92, Math.max(35, Math.round(score)));
}

export function resolveConfidenceLevel(input: ConfidenceInput): DutyConfidenceLevel {
  if (input.needsAdminReview) return "ADMIN_REVIEW_REQUIRED";
  if (input.verifiedProfile && input.calibration.exactFixtureMatch) return "VERIFIED_PROFILE_HIGH";
  if (input.verifiedProfile && input.hsCertainty === "EXACT" && input.cohort.length >= 1) return "STRONG_EVIDENCE";
  if (input.cohort.length >= 3 && input.vehicleDataComplete) return "MODERATE_EVIDENCE";
  if (input.cohort.length >= 1 || input.similarImports.length >= 1) return "LIMITED_EVIDENCE";
  return "ADMIN_REVIEW_REQUIRED";
}

export function computeCalibratedConfidence(input: ConfidenceInput): ConfidenceResult {
  const level = resolveConfidenceLevel(input);
  const reasons: string[] = [];
  let score = 55;

  if (level === "VERIFIED_PROFILE_HIGH") {
    score = 88;
    reasons.push("Verified BoE-calibrated rule profile");
    reasons.push("Exact make/model fixture match");
  } else if (level === "STRONG_EVIDENCE") {
    score = 78;
    reasons.push("Verified rule profile");
    reasons.push("Matching historical cohort");
  } else if (level === "MODERATE_EVIDENCE") {
    score = 68;
    reasons.push("Similar verified imports");
    reasons.push("Partial vehicle specification match");
  } else if (level === "LIMITED_EVIDENCE") {
    score = 52;
    reasons.push("Limited verified import history");
  } else {
    score = 40;
    reasons.push("Classification or data requires review");
  }

  if (input.hsCertainty === "EXACT") {
    score += 4;
    reasons.push("Exact HS code resolved");
  } else if (input.hsCertainty === "HEADING") {
    score += 2;
  }

  if (input.vehicleDataComplete) {
    score += 3;
    reasons.push("Complete vehicle specification");
  }

  if (input.customsValueCertainty === "DECLARED") {
    score += 2;
    reasons.push("Declared purchase value used");
  }

  if (input.fxRateCertainty === "ASSESSMENT_DATE" || input.fxRateCertainty === "CONFIGURED") {
    score += 2;
    reasons.push("Configured exchange rate");
  }

  if (input.calibration.cohortSize >= 3) {
    score += 4;
    reasons.push(`${input.calibration.cohortSize} similar verified cases`);
  } else if (input.calibration.cohortSize > 0) {
    reasons.push(`${input.calibration.cohortSize} similar case(s) only`);
  }

  if (input.evaluationMetrics && !input.evaluationMetrics.generalizedAccuracyClaimSupported) {
    score = Math.min(score, 85);
    reasons.push("Generalized accuracy not yet measured on sufficient holdout data");
  }

  const legacyLabel: ConfidenceResult["label"] =
    level === "VERIFIED_PROFILE_HIGH" || level === "STRONG_EVIDENCE"
      ? "HIGH"
      : level === "MODERATE_EVIDENCE"
        ? "MEDIUM"
        : "LOW";

  return {
    score: clampScore(score),
    label: legacyLabel,
    level,
    similarImportCount: input.cohort.length || input.similarImports.length,
    basisNote: buildBasisNote(level, input),
    reasons: [...new Set(reasons)],
    uncertaintyReasons: buildUncertaintyReasons(input, level),
  };
}

function buildBasisNote(level: DutyConfidenceLevel, input: ConfidenceInput): string {
  if (level === "VERIFIED_PROFILE_HIGH") {
    return `Verified rule profile ${input.profileId ?? ""} with exact BoE-calibrated reference case.`;
  }
  if (level === "STRONG_EVIDENCE") {
    return `Based on verified rule profile and ${input.cohort.length} matching historical case(s).`;
  }
  if (level === "MODERATE_EVIDENCE") {
    return `Estimate informed by ${input.cohort.length} similar verified imports and configured rules.`;
  }
  if (level === "LIMITED_EVIDENCE") {
    return "Limited verified data — treat as planning estimate only.";
  }
  return "Additional vehicle or classification data is needed before presenting a precise total.";
}

function buildUncertaintyReasons(input: ConfidenceInput, level: DutyConfidenceLevel): string[] {
  const reasons: string[] = [];
  if (level === "LIMITED_EVIDENCE") reasons.push("Small historical cohort");
  if (input.hsCertainty === "INFERRED" || input.hsCertainty === "UNKNOWN") {
    reasons.push("HS classification inferred — confirm specifications");
  }
  if (!input.vehicleDataComplete) reasons.push("Incomplete vehicle specification");
  if (input.customsValueCertainty === "COHORT_HINT") reasons.push("Customs value uses cohort ratio hint");
  if (input.calibration.expectedVariancePct >= 8) {
    reasons.push(`Expected variance band ~${input.calibration.expectedVariancePct}%`);
  }
  return reasons;
}

export function buildHistoricalComparison(params: {
  similarImports: SimilarImportMatch[];
  estimatedDutyGhs: number;
  cohort?: CohortRecord[];
}): HistoricalComparison | null {
  const cohortDuty = params.cohort?.filter((c) => c.totalDutyGhs != null && c.totalDutyGhs > 0) ?? [];
  if (cohortDuty.length > 0) {
    const avgActualDutyGhs =
      Math.round((cohortDuty.reduce((s, c) => s + (c.totalDutyGhs ?? 0), 0) / cohortDuty.length) * 100) / 100;
    const differencePct =
      avgActualDutyGhs > 0
        ? Math.round((Math.abs(params.estimatedDutyGhs - avgActualDutyGhs) / avgActualDutyGhs) * 1000) / 10
        : null;
    return {
      similarImportCount: cohortDuty.length,
      avgActualDutyGhs,
      estimatedDutyGhs: params.estimatedDutyGhs,
      differencePct,
      note:
        differencePct != null && differencePct < 2
          ? `Estimate aligns within ${differencePct}% of ${cohortDuty.length} matched verified case(s).`
          : `Compared against ${cohortDuty.length} matched verified case(s) — avg duty ${avgActualDutyGhs.toLocaleString()} GHS.`,
    };
  }

  const withDuty = params.similarImports.filter((m) => m.totalDutyGhs != null && m.totalDutyGhs > 0);
  if (withDuty.length === 0) return null;

  const avgActualDutyGhs =
    Math.round((withDuty.reduce((s, m) => s + (m.totalDutyGhs ?? 0), 0) / withDuty.length) * 100) / 100;

  const differencePct =
    avgActualDutyGhs > 0
      ? Math.round((Math.abs(params.estimatedDutyGhs - avgActualDutyGhs) / avgActualDutyGhs) * 1000) / 10
      : null;

  return {
    similarImportCount: withDuty.length,
    avgActualDutyGhs,
    estimatedDutyGhs: params.estimatedDutyGhs,
    differencePct,
    note:
      differencePct != null && differencePct < 2
        ? `Estimate aligns within ${differencePct}% of ${withDuty.length} similar cleared imports.`
        : `Compared against ${withDuty.length} similar imports — avg actual duty ${avgActualDutyGhs.toLocaleString()} GHS.`,
  };
}

/** @deprecated Use computeCalibratedConfidence — kept for legacy tests */
export function computeConfidence(
  similarImports: SimilarImportMatch[],
  input?: DutyCalculationInput,
): ConfidenceResult {
  return computeCalibratedConfidence({
    verifiedProfile: false,
    hsCertainty: "INFERRED",
    vehicleDataComplete: Boolean(input?.vehicle.engineCc || input?.vehicle.fuelType === "ELECTRIC"),
    customsValueCertainty: "DECLARED",
    fxRateCertainty: "CONFIGURED",
    ruleVerificationStatus: "UNVERIFIED",
    cohort: [],
    calibration: {
      valuation: { method: "NONE", cohortSize: 0, note: "" },
      adjustments: [],
      expectedVariancePct: 12,
      cohortSize: 0,
      exactFixtureMatch: false,
      assumptions: [],
    },
    similarImports,
    input,
  });
}

export function confidenceLevelToDisplayScore(level: DutyConfidenceLevel): string {
  switch (level) {
    case "VERIFIED_PROFILE_HIGH":
      return "Verified profile";
    case "STRONG_EVIDENCE":
      return "Strong evidence";
    case "MODERATE_EVIDENCE":
      return "Moderate evidence";
    case "LIMITED_EVIDENCE":
      return "Limited evidence";
    case "ADMIN_REVIEW_REQUIRED":
      return "Review required";
  }
}
