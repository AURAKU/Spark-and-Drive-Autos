import type { GlobalCurrencySettings } from "@prisma/client";

import { depositAmountGhsFromFull, resolveReservationDepositPercent } from "@/lib/checkout-amount";
import { getCarDisplayPrice } from "@/lib/currency";

/** Days after reservation before admin surfaces “follow up required” (no cron). */
export const DEPOSIT_FOLLOW_UP_DAYS = 7;

export type VehicleCurrencyBase = "GHS" | "USD" | "CNY";

export type VehicleListPriceResolution = {
  fullListGhs: number;
  currencyBase: VehicleCurrencyBase;
  /** FX multiplier used when converting USD/CNY anchor → GHS; null when native GHS list or legacy RMB path without separate snapshot */
  exchangeRateUsed: number | null;
};

/**
 * Resolve list price in GHS using explicit optional columns first:
 * priceGhs → priceUsd (via usdToGhs) → priceCny (via rmbToGhs) → legacy basePriceRmb conversion.
 */
/** Rates needed for legacy RMB list → GHS (matches `getCarDisplayPrice` / `FxRatesInput`). */
export type VehicleFxForDeposit = Pick<GlobalCurrencySettings, "rmbToGhs" | "usdToGhs" | "usdToRmb">;

export function resolveVehicleListPriceGhs(
  car: {
    basePriceRmb: unknown;
    priceGhs?: unknown;
    priceUsd?: unknown;
    priceCny?: unknown;
  },
  fx: VehicleFxForDeposit,
): VehicleListPriceResolution {
  const pg = car.priceGhs != null ? Number(car.priceGhs) : NaN;
  if (Number.isFinite(pg) && pg > 0) {
    return { fullListGhs: pg, currencyBase: "GHS", exchangeRateUsed: null };
  }
  const pu = car.priceUsd != null ? Number(car.priceUsd) : NaN;
  if (Number.isFinite(pu) && pu > 0) {
    const rate = Number(fx.usdToGhs);
    return {
      fullListGhs: pu * rate,
      currencyBase: "USD",
      exchangeRateUsed: Number.isFinite(rate) ? rate : null,
    };
  }
  const pc = car.priceCny != null ? Number(car.priceCny) : NaN;
  if (Number.isFinite(pc) && pc > 0) {
    const rate = Number(fx.rmbToGhs);
    return {
      fullListGhs: pc * rate,
      currencyBase: "CNY",
      exchangeRateUsed: Number.isFinite(rate) ? rate : null,
    };
  }
  const rmb = Number(car.basePriceRmb);
  const legacy = getCarDisplayPrice(rmb, "GHS", fx);
  const rate = Number(fx.rmbToGhs);
  return {
    fullListGhs: legacy,
    currencyBase: "GHS",
    exchangeRateUsed: Number.isFinite(rate) ? rate : null,
  };
}

export type DepositCheckoutSnapshot = {
  depositGhs: number;
  remainingBalance: number;
  resolution: VehicleListPriceResolution;
  depositPercentApplied: number;
};

/** Snapshot list totals for persisting on `Order` (GHS list + optional base-currency anchor). */
export function resolveOrderStorageAnchors(
  car: {
    basePriceRmb: unknown;
    priceGhs?: unknown;
    priceUsd?: unknown;
    priceCny?: unknown;
  },
  resolution: VehicleListPriceResolution,
): { vehicleListPriceGhs: number; baseAmount: number | null } {
  const vehicleListPriceGhs = Math.round(Math.max(0, resolution.fullListGhs) * 100) / 100;
  let baseAmount: number | null = null;
  if (resolution.currencyBase === "GHS") {
    const pg = car.priceGhs != null ? Number(car.priceGhs) : NaN;
    baseAmount = Number.isFinite(pg) && pg > 0 ? pg : vehicleListPriceGhs;
  } else if (resolution.currencyBase === "USD") {
    const pu = car.priceUsd != null ? Number(car.priceUsd) : NaN;
    baseAmount = Number.isFinite(pu) && pu > 0 ? pu : null;
  } else if (resolution.currencyBase === "CNY") {
    const pc = car.priceCny != null ? Number(car.priceCny) : NaN;
    baseAmount = Number.isFinite(pc) && pc > 0 ? pc : Number(car.basePriceRmb);
  }
  return { vehicleListPriceGhs, baseAmount };
}

/** Deposit checkout only — FULL payment continues to use `getVehicleCheckoutAmountGhs` + basePriceRmb path. */
export function computeDepositCheckoutSnapshot(
  car: Parameters<typeof resolveVehicleListPriceGhs>[0],
  fx: VehicleFxForDeposit,
  reservationDepositPercentStored: number | null | undefined,
): DepositCheckoutSnapshot {
  const resolution = resolveVehicleListPriceGhs(car, fx);
  const depositPct = resolveReservationDepositPercent(reservationDepositPercentStored);
  const depositGhs = depositAmountGhsFromFull(resolution.fullListGhs, reservationDepositPercentStored);
  const remainingBalance =
    Math.round(Math.max(0, resolution.fullListGhs - depositGhs) * 100) / 100;
  return {
    depositGhs,
    remainingBalance,
    resolution,
    depositPercentApplied: depositPct,
  };
}
