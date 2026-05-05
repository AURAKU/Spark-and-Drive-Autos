import type { GlobalCurrencySettings } from "@prisma/client";
import { PaymentType } from "@prisma/client";

import { getCarDisplayPrice } from "@/lib/currency";

/** When per-car % is unset and settings row is missing/invalid, use this % of list price (GHS). */
export const DEFAULT_RESERVATION_DEPOSIT_PERCENT = 5;

function clampValidDepositPercent(n: number): number {
  if (!Number.isFinite(n) || n <= 0 || n > 100) return DEFAULT_RESERVATION_DEPOSIT_PERCENT;
  return n;
}

/**
 * Global default % from `GlobalCurrencySettings` (editable by admin).
 */
export function globalReservationDepositPercentFromSettings(
  s: Pick<GlobalCurrencySettings, "defaultReservationDepositPercent"> | null | undefined,
): number {
  const raw =
    s?.defaultReservationDepositPercent != null ? Number(s.defaultReservationDepositPercent) : NaN;
  return clampValidDepositPercent(raw);
}

/**
 * Effective % for reservation deposit: per-car when set and valid (0–100 exclusive of 0), else `globalDefault`.
 */
export function resolveReservationDepositPercent(
  stored: number | string | null | undefined,
  globalDefault: number = DEFAULT_RESERVATION_DEPOSIT_PERCENT,
): number {
  const g = clampValidDepositPercent(globalDefault);
  if (stored == null || stored === "") return g;
  const n = Number(stored);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return g;
  return n;
}

/** Deposit in GHS: `fullListGhs * effectivePercent / 100` (no fixed minimum; Paystack amount is this value). */
export function depositAmountGhsFromFull(
  fullListGhs: number,
  storedPercent: number | null | undefined,
  globalDefault: number,
): number {
  if (!Number.isFinite(fullListGhs) || fullListGhs <= 0) return 0;
  const pct = resolveReservationDepositPercent(storedPercent, globalDefault);
  return Math.round(((fullListGhs * pct) / 100) * 100) / 100;
}

/**
 * @deprecated Prefer `getVehicleSettlementAmountGhs` in `@/lib/vehicle-deposit-pricing` for multi-currency list prices.
 * Legacy RMB-only list → GHS settlement.
 */
export function getVehicleCheckoutAmountGhs(
  basePriceRmb: number,
  paymentType: PaymentType,
  settings: Pick<GlobalCurrencySettings, "usdToRmb" | "rmbToGhs" | "usdToGhs" | "defaultReservationDepositPercent">,
  reservationDepositPercentStored?: number | null,
): number {
  const full = getCarDisplayPrice(basePriceRmb, "GHS", settings);
  const globalPct = globalReservationDepositPercentFromSettings(settings);
  return paymentType === "RESERVATION_DEPOSIT"
    ? depositAmountGhsFromFull(full, reservationDepositPercentStored, globalPct)
    : full;
}
