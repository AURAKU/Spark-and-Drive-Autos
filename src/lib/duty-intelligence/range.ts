import { money, moneyToNumber } from "./money";
import type { CalibrationLayerResult } from "./calibration-engine";
import type { DutyConfidenceLevel } from "./types";

export type EstimateRange = {
  baseGhs: number;
  lowGhs: number;
  highGhs: number;
  bandPct: number;
  expectedGhs: number;
};

function bandForLevel(level: DutyConfidenceLevel, expectedVariancePct: number): number {
  if (level === "VERIFIED_PROFILE_HIGH") return 0;
  if (level === "STRONG_EVIDENCE") return Math.max(0.02, expectedVariancePct / 100);
  if (level === "MODERATE_EVIDENCE") return Math.max(0.05, expectedVariancePct / 100);
  if (level === "LIMITED_EVIDENCE") return Math.max(0.1, expectedVariancePct / 100);
  return 0.15;
}

export function buildEstimateRange(params: {
  baseGhs: number;
  verifiedProfile: boolean;
  confidenceLevel?: DutyConfidenceLevel;
  confidenceScore?: number;
  calibration?: CalibrationLayerResult;
  landedCostGhs?: number;
}): EstimateRange {
  const level = params.confidenceLevel ?? (params.verifiedProfile ? "VERIFIED_PROFILE_HIGH" : "LIMITED_EVIDENCE");
  const variance = params.calibration?.expectedVariancePct ?? 12;
  const band = bandForLevel(level, variance);

  if (band === 0) {
    const total = params.landedCostGhs ?? params.baseGhs;
    return {
      baseGhs: params.baseGhs,
      expectedGhs: params.baseGhs,
      lowGhs: params.baseGhs,
      highGhs: params.baseGhs,
      bandPct: 0,
    };
  }

  const low = money(params.baseGhs).times(1 - band);
  const high = money(params.baseGhs).times(1 + band);

  return {
    baseGhs: params.baseGhs,
    expectedGhs: params.baseGhs,
    lowGhs: moneyToNumber(low),
    highGhs: moneyToNumber(high),
    bandPct: band,
  };
}

export function buildLandedCostRange(params: {
  customsValueGhs: number;
  dutyRange: EstimateRange;
}): { lowGhs: number; expectedGhs: number; highGhs: number } {
  return {
    lowGhs: moneyToNumber(money(params.customsValueGhs).plus(params.dutyRange.lowGhs)),
    expectedGhs: moneyToNumber(money(params.customsValueGhs).plus(params.dutyRange.expectedGhs)),
    highGhs: moneyToNumber(money(params.customsValueGhs).plus(params.dutyRange.highGhs)),
  };
}
