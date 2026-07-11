import { money, moneyToNumber } from "./money";

export type CustomsValueInput = {
  fobGhs: string | number;
  freightGhs: string | number;
  insuranceGhs: string | number;
  customsValueOverride?: string | number;
  cifOverride?: string | number;
  depreciationPercent?: string | number;
};

export function resolveCustomsValue(input: CustomsValueInput): {
  cifGhs: number;
  customsValueGhs: number;
  depreciatedCustomsValueGhs: number;
} {
  const fob = money(input.fobGhs);
  const freight = money(input.freightGhs);
  const insurance = money(input.insuranceGhs);

  const cif = input.cifOverride != null ? money(input.cifOverride) : fob.plus(freight).plus(insurance);
  let customs = input.customsValueOverride != null ? money(input.customsValueOverride) : cif;

  if (input.depreciationPercent != null && Number(input.depreciationPercent) > 0) {
    const factor = money(1).minus(money(input.depreciationPercent));
    customs = customs.times(factor);
  }

  return {
    cifGhs: moneyToNumber(cif),
    customsValueGhs: moneyToNumber(customs),
    depreciatedCustomsValueGhs: moneyToNumber(customs),
  };
}
