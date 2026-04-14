import type { PaymentType } from "@prisma/client";

import type { GlobalCurrencySettings } from "@prisma/client";
import { getCarDisplayPrice } from "@/lib/currency";

export function depositAmountGhsFromFull(fullGhs: number): number {
  const pct = Math.round(fullGhs * 0.05);
  return Math.max(pct, 5000);
}

export function getVehicleCheckoutAmountGhs(
  basePriceRmb: number,
  paymentType: PaymentType,
  settings: Pick<GlobalCurrencySettings, "usdToRmb" | "rmbToGhs" | "usdToGhs">
): number {
  const full = getCarDisplayPrice(basePriceRmb, "GHS", settings);
  return paymentType === "RESERVATION_DEPOSIT" ? depositAmountGhsFromFull(full) : full;
}
