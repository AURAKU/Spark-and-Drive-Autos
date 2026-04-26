import type { GlobalCurrencySettings } from "@prisma/client";
import { DeliveryFeeCurrency } from "@prisma/client";

import { convertGhsToDisplay, type FxRatesInput } from "@/lib/currency";

const DEFAULT_USD_TO_GHS = 11.65;
const DEFAULT_USD_TO_RMB = 7;

/** Persist template fees from admin amount + currency (checkout still uses stored GHS). */
export function storedFeesFromAdminInput(
  amount: number,
  currency: DeliveryFeeCurrency,
  s: Pick<GlobalCurrencySettings, "usdToGhs" | "usdToRmb" | "rmbToGhs">,
): { feeGhs: number; feeRmb: number } {
  if (currency === DeliveryFeeCurrency.USD) {
    const usdToGhs = Number(s.usdToGhs);
    const usdToRmb = Number(s.usdToRmb);
    const feeGhs =
      Number.isFinite(usdToGhs) && usdToGhs > 0 ? Math.round(amount * usdToGhs) : Math.round(amount * DEFAULT_USD_TO_GHS);
    const feeRmb =
      Number.isFinite(usdToRmb) && usdToRmb > 0 ? amount * usdToRmb : amount * DEFAULT_USD_TO_RMB;
    return { feeGhs, feeRmb };
  }
  const feeGhs = Math.round(amount);
  const feeRmb = convertGhsToDisplay(feeGhs, "CNY", s as FxRatesInput);
  return { feeGhs, feeRmb };
}

/** Amount to show in the admin fee field for the selected currency. */
export function adminFeeAmountForDisplay(
  feeGhs: number,
  feeCurrency: DeliveryFeeCurrency,
  s: Pick<GlobalCurrencySettings, "usdToGhs">,
): number {
  if (feeCurrency === DeliveryFeeCurrency.USD) {
    const usdToGhs = Number(s.usdToGhs);
    if (!Number.isFinite(usdToGhs) || usdToGhs <= 0) return Math.round((feeGhs / DEFAULT_USD_TO_GHS) * 100) / 100;
    return Math.round((feeGhs / usdToGhs) * 100) / 100;
  }
  return feeGhs;
}
