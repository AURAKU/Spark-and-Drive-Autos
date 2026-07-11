import Decimal from "decimal.js";

import type { Money } from "./money";

export type RoundingMode = "HALF_UP" | "HALF_EVEN" | "FLOOR" | "CEIL";

const ROUNDING_MAP: Record<RoundingMode, Decimal.Rounding> = {
  HALF_UP: Decimal.ROUND_HALF_UP,
  HALF_EVEN: Decimal.ROUND_HALF_EVEN,
  FLOOR: Decimal.ROUND_FLOOR,
  CEIL: Decimal.ROUND_CEIL,
};

export function roundMoney(value: Money, decimalPlaces: number, mode: RoundingMode = "HALF_UP"): Money {
  return value.toDecimalPlaces(decimalPlaces, ROUNDING_MAP[mode]);
}

export const DEFAULT_ROUNDING_TOLERANCE = new Decimal("0.02");

export function withinTolerance(actual: Money, expected: Money, tolerance = DEFAULT_ROUNDING_TOLERANCE): boolean {
  return actual.minus(expected).abs().lte(tolerance);
}

export type ReconciliationReport = {
  lineTotal: number;
  documentedTotal: number;
  variance: number;
  withinTolerance: boolean;
  unexplainedVariance: boolean;
};

export function reconcileTotals(params: {
  calculatedLineTotal: Money;
  documentedTotal: Money;
  tolerance?: Money;
}): ReconciliationReport {
  const tolerance = params.tolerance ?? DEFAULT_ROUNDING_TOLERANCE;
  const variance = params.calculatedLineTotal.minus(params.documentedTotal);
  const ok = variance.abs().lte(tolerance);
  return {
    lineTotal: params.calculatedLineTotal.toNumber(),
    documentedTotal: params.documentedTotal.toNumber(),
    variance: variance.toNumber(),
    withinTolerance: ok,
    unexplainedVariance: !ok,
  };
}
