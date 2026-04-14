import {
  type DisplayCurrency,
  type FxRatesInput,
  convertGhsToDisplay,
  formatConverted,
} from "@/lib/currency";
import { amountToGhs } from "@/lib/inventory-profit";

export function formatIntelMoneyFromGhs(amountGhs: number, dc: DisplayCurrency, fx: FxRatesInput): string {
  const v = convertGhsToDisplay(amountGhs, dc, fx);
  return formatConverted(v, dc);
}

export function formatIntelPaymentAmount(
  amount: number,
  currency: string,
  dc: DisplayCurrency,
  fx: FxRatesInput,
): string {
  const g = amountToGhs(amount, currency, fx);
  return formatIntelMoneyFromGhs(g, dc, fx);
}
