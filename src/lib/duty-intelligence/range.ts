import { money, moneyToNumber } from "./money";

export type EstimateRange = {
  baseGhs: number;
  lowGhs: number;
  highGhs: number;
  bandPct: number;
};

export function buildEstimateRange(params: {
  baseGhs: number;
  verifiedProfile: boolean;
  confidenceScore?: number;
}): EstimateRange {
  if (params.verifiedProfile) {
    return {
      baseGhs: params.baseGhs,
      lowGhs: params.baseGhs,
      highGhs: params.baseGhs,
      bandPct: 0,
    };
  }

  const band = params.confidenceScore != null && params.confidenceScore >= 80 ? 0.05 : 0.12;
  const low = money(params.baseGhs).times(1 - band);
  const high = money(params.baseGhs).times(1 + band);

  return {
    baseGhs: params.baseGhs,
    lowGhs: moneyToNumber(low),
    highGhs: moneyToNumber(high),
    bandPct: band,
  };
}
