import type { PaymentType } from "@prisma/client";

import type { GlobalCurrencySettings } from "@prisma/client";
import { getCarDisplayPrice } from "@/lib/currency";

/** When `reservationDepositPercent` is null on the vehicle, use this % of list price (GHS). */
export const DEFAULT_RESERVATION_DEPOSIT_PERCENT = 5;

/** Minimum reservation deposit in GHS (same as legacy behavior). */
export const DEFAULT_RESERVATION_DEPOSIT_MIN_GHS = 5000;

/**
 * Effective % of list price (GHS) for reservation deposit.
 * `null`/`undefined` stored on the car → default percent.
 */
export function resolveReservationDepositPercent(stored: number | string | null | undefined): number {
  if (stored == null || stored === "") return DEFAULT_RESERVATION_DEPOSIT_PERCENT;
  const n = Number(stored);
  if (!Number.isFinite(n)) return DEFAULT_RESERVATION_DEPOSIT_PERCENT;
  return Math.min(100, Math.max(0, n));
}

/** Deposit in GHS from full list price (GHS) and optional per-vehicle percent. */
export function depositAmountGhsFromFull(fullGhs: number, storedPercent: number | null | undefined): number {
  const pct = resolveReservationDepositPercent(storedPercent);
  const fromPct = Math.round((fullGhs * pct) / 100);
  return Math.max(fromPct, DEFAULT_RESERVATION_DEPOSIT_MIN_GHS);
}

export function getVehicleCheckoutAmountGhs(
  basePriceRmb: number,
  paymentType: PaymentType,
  settings: Pick<GlobalCurrencySettings, "usdToRmb" | "rmbToGhs" | "usdToGhs">,
  reservationDepositPercentStored?: number | null,
): number {
  const full = getCarDisplayPrice(basePriceRmb, "GHS", settings);
  return paymentType === "RESERVATION_DEPOSIT"
    ? depositAmountGhsFromFull(full, reservationDepositPercentStored)
    : full;
}
