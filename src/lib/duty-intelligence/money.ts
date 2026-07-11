import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type Money = Decimal;

export function money(value: string | number | Decimal): Money {
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

export function moneyZero(): Money {
  return new Decimal(0);
}

export function moneySum(values: Money[]): Money {
  return values.reduce((acc, v) => acc.plus(v), moneyZero());
}

export function moneyToNumber(value: Money, decimalPlaces = 2): number {
  return value.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP).toNumber();
}

export function moneyToString(value: Money, decimalPlaces = 2): string {
  return value.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP).toFixed(decimalPlaces);
}

export function assertNonNegative(value: Money, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label} cannot be negative`);
  }
}
