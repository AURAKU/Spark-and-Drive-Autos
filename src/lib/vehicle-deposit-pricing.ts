import type { GlobalCurrencySettings } from "@prisma/client";
import { PaymentType } from "@prisma/client";

import {
  depositAmountGhsFromFull,
  globalReservationDepositPercentFromSettings,
  resolveReservationDepositPercent,
} from "@/lib/checkout-amount";
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

function normalizeListCurrency(raw: string | null | undefined): string {
  const c = String(raw ?? "GHS").trim().toUpperCase();
  if (c === "RMB") return "CNY";
  return c || "GHS";
}

/**
 * List price in GHS from admin **base selling** amount + currency (priority path).
 */
export function tryResolveListGhsFromBaseSelling(
  basePriceAmount: unknown,
  basePriceCurrency: string | null | undefined,
  fx: VehicleFxForDeposit,
): VehicleListPriceResolution | null {
  const baseAmount = Number(basePriceAmount);
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) return null;
  const cur = normalizeListCurrency(basePriceCurrency);
  if (cur === "GHS") {
    return { fullListGhs: Math.round(baseAmount * 100) / 100, currencyBase: "GHS", exchangeRateUsed: null };
  }
  if (cur === "USD") {
    const rate = Number(fx.usdToGhs);
    if (!Number.isFinite(rate) || rate <= 0) return null;
    return {
      fullListGhs: Math.round(baseAmount * rate * 100) / 100,
      currencyBase: "USD",
      exchangeRateUsed: rate,
    };
  }
  if (cur === "CNY") {
    const div = Number(fx.rmbToGhs);
    if (!Number.isFinite(div) || div <= 0) return null;
    return {
      fullListGhs: Math.round(baseAmount / div),
      currencyBase: "CNY",
      exchangeRateUsed: div,
    };
  }
  return null;
}

/**
 * Deposit and balance from admin base selling price (same currency), then GHS equivalents for Paystack.
 *
 * `depositAmount = Math.round((basePriceAmount * depositPercentage) / 100)`
 * `balanceDue = basePriceAmount - depositAmount`
 */
export function depositAndBalanceFromBaseSellingAmount(
  basePriceAmount: number,
  basePriceCurrency: string | null | undefined,
  depositPercentage: number,
  fx: VehicleFxForDeposit,
): {
  depositAmount: number;
  balanceDue: number;
  depositGhs: number;
  fullListGhs: number;
  remainingBalanceGhs: number;
} | null {
  if (!Number.isFinite(basePriceAmount) || basePriceAmount <= 0) return null;
  if (!Number.isFinite(depositPercentage) || depositPercentage <= 0) return null;

  const depositAmount = Math.round((basePriceAmount * depositPercentage) / 100);
  const balanceDue = basePriceAmount - depositAmount;
  if (depositAmount <= 0 || balanceDue < 0) return null;

  const cur = normalizeListCurrency(basePriceCurrency);
  let fullListGhs: number;
  let depositGhs: number;

  if (cur === "GHS") {
    fullListGhs = Math.round(basePriceAmount * 100) / 100;
    depositGhs = depositAmount;
  } else if (cur === "USD") {
    const r = Number(fx.usdToGhs);
    if (!Number.isFinite(r) || r <= 0) return null;
    fullListGhs = Math.round(basePriceAmount * r * 100) / 100;
    depositGhs = Math.round(depositAmount * r * 100) / 100;
  } else if (cur === "CNY") {
    const div = Number(fx.rmbToGhs);
    if (!Number.isFinite(div) || div <= 0) return null;
    fullListGhs = Math.round(basePriceAmount / div);
    depositGhs = Math.round(depositAmount / div);
  } else return null;

  const remainingBalanceGhs = Math.round(Math.max(0, fullListGhs - depositGhs) * 100) / 100;
  return { depositAmount, balanceDue, depositGhs, fullListGhs, remainingBalanceGhs };
}

export function resolveVehicleListPriceGhs(
  car: {
    basePriceRmb: unknown;
    basePriceAmount?: unknown;
    basePriceCurrency?: string | null;
    priceGhs?: unknown;
    priceUsd?: unknown;
    priceCny?: unknown;
  },
  fx: VehicleFxForDeposit,
): VehicleListPriceResolution {
  const fromBase = tryResolveListGhsFromBaseSelling(car.basePriceAmount, car.basePriceCurrency, fx);
  if (fromBase) return fromBase;

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
    basePriceAmount?: unknown;
    basePriceCurrency?: string | null;
    priceGhs?: unknown;
    priceUsd?: unknown;
    priceCny?: unknown;
  },
  resolution: VehicleListPriceResolution,
): { vehicleListPriceGhs: number; baseAmount: number | null } {
  const vehicleListPriceGhs = Math.round(Math.max(0, resolution.fullListGhs) * 100) / 100;
  const baseSell = car.basePriceAmount != null ? Number(car.basePriceAmount) : NaN;
  if (Number.isFinite(baseSell) && baseSell > 0) {
    return { vehicleListPriceGhs, baseAmount: baseSell };
  }
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

/**
 * Canonical vehicle settlement in GHS for Paystack/offline: full list or % deposit from resolved list price.
 * Returns null when list price ≤ 0 or (deposit path) computed deposit ≤ 0.
 */
export function getVehicleSettlementAmountGhs(
  car: Parameters<typeof resolveVehicleListPriceGhs>[0],
  paymentType: PaymentType,
  settings: Pick<
    GlobalCurrencySettings,
    "rmbToGhs" | "usdToGhs" | "usdToRmb" | "defaultReservationDepositPercent"
  >,
  carReservationPctStored: number | null | undefined,
): {
  settlementGhs: number;
  fullListGhs: number;
  resolution: VehicleListPriceResolution;
  depositPercentApplied: number;
} | null {
  const resolution = resolveVehicleListPriceGhs(car, settings);
  const fullListGhs = Math.round(Math.max(0, resolution.fullListGhs) * 100) / 100;
  if (fullListGhs <= 0) return null;
  const globalPct = globalReservationDepositPercentFromSettings(settings);

  if (paymentType === PaymentType.RESERVATION_DEPOSIT) {
    const depositPct = resolveReservationDepositPercent(carReservationPctStored, globalPct);
    const baseAmt = car.basePriceAmount != null ? Number(car.basePriceAmount) : NaN;
    if (Number.isFinite(baseAmt) && baseAmt > 0) {
      const d = depositAndBalanceFromBaseSellingAmount(baseAmt, car.basePriceCurrency, depositPct, settings);
      if (!d || d.depositGhs <= 0) return null;
      return {
        settlementGhs: d.depositGhs,
        fullListGhs: d.fullListGhs,
        resolution,
        depositPercentApplied: depositPct,
      };
    }
    const settlementGhs = depositAmountGhsFromFull(fullListGhs, carReservationPctStored, globalPct);
    if (settlementGhs <= 0) return null;
    return {
      settlementGhs,
      fullListGhs,
      resolution,
      depositPercentApplied: depositPct,
    };
  }

  return {
    settlementGhs: fullListGhs,
    fullListGhs,
    resolution,
    depositPercentApplied: 0,
  };
}

/** Deposit checkout snapshot — `globalReservationDepositPercent` from `getGlobalCurrencySettings()`. */
export function computeDepositCheckoutSnapshot(
  car: Parameters<typeof resolveVehicleListPriceGhs>[0],
  fx: VehicleFxForDeposit,
  reservationDepositPercentStored: number | null | undefined,
  globalReservationDepositPercent: number,
): DepositCheckoutSnapshot | null {
  const globalPct = globalReservationDepositPercent;
  const depositPct = resolveReservationDepositPercent(reservationDepositPercentStored, globalPct);

  const baseAmt = car.basePriceAmount != null ? Number(car.basePriceAmount) : NaN;
  if (Number.isFinite(baseAmt) && baseAmt > 0) {
    const d = depositAndBalanceFromBaseSellingAmount(baseAmt, car.basePriceCurrency, depositPct, fx);
    const resolution = tryResolveListGhsFromBaseSelling(car.basePriceAmount, car.basePriceCurrency, fx);
    if (!d || !resolution || d.depositGhs <= 0) return null;
    return {
      depositGhs: d.depositGhs,
      remainingBalance: d.remainingBalanceGhs,
      resolution,
      depositPercentApplied: depositPct,
    };
  }

  const resolution = resolveVehicleListPriceGhs(car, fx);
  const fullListGhs = Math.round(Math.max(0, resolution.fullListGhs) * 100) / 100;
  if (fullListGhs <= 0) return null;
  const depositGhs = depositAmountGhsFromFull(fullListGhs, reservationDepositPercentStored, globalPct);
  if (depositGhs <= 0) return null;
  const remainingBalance = Math.round(Math.max(0, fullListGhs - depositGhs) * 100) / 100;
  return {
    depositGhs,
    remainingBalance,
    resolution,
    depositPercentApplied: depositPct,
  };
}
