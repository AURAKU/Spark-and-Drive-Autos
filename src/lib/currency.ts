import type { GlobalCurrencySettings } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Vehicle pricing — canonical stored value: `Car.basePriceRmb` (CNY/RMB).
 *
 * **Conversion rules (admin rates):**
 * - **RMB → GHS:** `GHS = round(RMB / rmbToGhs)` — divide by the stored rate (e.g. 10,000 ÷ 0.586 → 17,064 GHS).
 * - **GHS → RMB:** `RMB = GHS × rmbToGhs`.
 * - **USD → RMB:** `RMB = USD × usdToRmb` (e.g. 1,000 × 7 = 7,000 RMB).
 * - **RMB → USD:** `USD = RMB / usdToRmb`.
 * - **USD → GHS (direct):** `GHS = USD × usdToGhs` (e.g. 100 × 11.65 = 1,165 GHS).
 * - **GHS → USD (direct):** `USD = GHS / usdToGhs`.
 *
 * Display: GHS amounts are **whole numbers**; USD uses two decimal places in formatting.
 */

export type DisplayCurrency = "GHS" | "USD" | "CNY";

/** Server-passed vehicle pricing line for checkout / summaries */
export type VehiclePricePreview = {
  title: string;
  basePriceRmb: number;
  displayAmount: number;
  displayCurrency: DisplayCurrency;
  sourceType?: "IN_GHANA" | "IN_CHINA" | "IN_TRANSIT";
  /** Estimated sea freight (GHS), if configured on the listing. */
  seaShippingFeeGhs?: number | null;
  /** GHS charged at checkout (full price or reservation deposit), from admin RMB→GHS parameters. */
  settlementGhs: number;
  /** Full vehicle total in GHS (before deposit rule), for deposit checkout context. */
  fullGhs: number;
  /** % of list price (GHS) used for reservation deposit; set when `paymentType` is `RESERVATION_DEPOSIT`. */
  reservationDepositPercentApplied: number;
  /** Admin divisor D where GHS = round(RMB ÷ D). */
  rmbToGhsDivisor: number;
  paymentType: "FULL" | "RESERVATION_DEPOSIT";
};

/** UI labels — CNY is used interchangeably with RMB on the storefront. */
export const CURRENCY_LABELS: Record<DisplayCurrency, string> = {
  GHS: "GHS",
  USD: "USD",
  CNY: "CNY (RMB)",
};

export function parseDisplayCurrency(v: string | undefined | null): DisplayCurrency {
  if (v === "USD" || v === "CNY" || v === "GHS") return v;
  return "GHS";
}

const DEFAULT_SETTINGS = {
  usdToRmb: 7,
  rmbToGhs: 0.586,
  usdToGhs: 11.65,
};

/** Safe defaults when GlobalCurrencySettings cannot be read (offline DB / migration mismatch). */
export function fallbackGlobalCurrencySettings(): GlobalCurrencySettings {
  return {
    id: "default",
    usdToRmb: new Prisma.Decimal(DEFAULT_SETTINGS.usdToRmb),
    rmbToGhs: new Prisma.Decimal(DEFAULT_SETTINGS.rmbToGhs),
    usdToGhs: new Prisma.Decimal(DEFAULT_SETTINGS.usdToGhs),
    updatedAt: new Date(),
    updatedById: null,
  };
}

/** Load singleton FX settings; creates defaults if missing. */
export async function getGlobalCurrencySettings(): Promise<GlobalCurrencySettings> {
  return getGlobalCurrencySettingsCached();
}

const getGlobalCurrencySettingsCached = unstable_cache(
  async (): Promise<GlobalCurrencySettings> => {
  const row = await prisma.globalCurrencySettings.findUnique({ where: { id: "default" } });
  if (row) return row;
  return prisma.globalCurrencySettings.create({
    data: {
      id: "default",
      usdToRmb: DEFAULT_SETTINGS.usdToRmb,
      rmbToGhs: DEFAULT_SETTINGS.rmbToGhs,
      usdToGhs: DEFAULT_SETTINGS.usdToGhs,
    },
  });
  },
  ["global-currency-settings:v1"],
  { revalidate: 60 },
);

/** FX inputs from DB (`Decimal`) or client preview (`number`). */
export type FxRatesInput = {
  usdToRmb: GlobalCurrencySettings["usdToRmb"] | number;
  rmbToGhs: GlobalCurrencySettings["rmbToGhs"] | number;
  usdToGhs: GlobalCurrencySettings["usdToGhs"] | number;
};

/**
 * Convert canonical **RMB** amount to a display currency.
 * - GHS: integer cedis via `round(RMB / rmbToGhs)`.
 * - USD: `RMB / usdToRmb`.
 * - CNY: unchanged (same as RMB).
 */
/** Convert a GHS amount into the selected display currency using admin FX settings. */
export function convertGhsToDisplay(amountGhs: number, target: DisplayCurrency, s: FxRatesInput): number {
  if (target === "GHS") return Math.round(amountGhs);
  const rmbToGhs = Number(s.rmbToGhs);
  const usdToGhs = Number(s.usdToGhs);
  if (target === "CNY") {
    if (!Number.isFinite(rmbToGhs) || rmbToGhs <= 0) return Math.round(amountGhs * DEFAULT_SETTINGS.rmbToGhs);
    return amountGhs * rmbToGhs;
  }
  if (target === "USD") {
    if (!Number.isFinite(usdToGhs) || usdToGhs <= 0) return amountGhs / DEFAULT_SETTINGS.usdToGhs;
    return amountGhs / usdToGhs;
  }
  return Math.round(amountGhs);
}

export function convertRmbTo(amountRmb: number, target: DisplayCurrency, s: FxRatesInput): number {
  const rmb = amountRmb;
  if (target === "CNY") return rmb;
  const divGhs = Number(s.rmbToGhs);
  if (target === "GHS") {
    if (!Number.isFinite(divGhs) || divGhs <= 0) return Math.round(rmb / DEFAULT_SETTINGS.rmbToGhs);
    return Math.round(rmb / divGhs);
  }
  const rmbPerUsd = Number(s.usdToRmb);
  if (!Number.isFinite(rmbPerUsd) || rmbPerUsd <= 0) return rmb / DEFAULT_SETTINGS.usdToRmb;
  return rmb / rmbPerUsd;
}

export function getCarDisplayPrice(basePriceRmb: number, target: DisplayCurrency, settings: FxRatesInput): number {
  return convertRmbTo(basePriceRmb, target, settings);
}

/**
 * Convert an admin-entered vehicle list price or supplier cost into canonical RMB
 * using the same rules as `ghsAmountToCanonicalRmb` / `usdAmountToCanonicalRmb` in admin autofill.
 */
export function adminAmountToCanonicalRmb(amount: number, currency: DisplayCurrency, s: FxRatesInput): number {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  if (currency === "CNY") return amount;
  const rmbToGhs = Number(s.rmbToGhs);
  if (currency === "GHS") {
    if (!Number.isFinite(rmbToGhs) || rmbToGhs <= 0) return 0;
    return amount * rmbToGhs;
  }
  const usdToRmb = Number(s.usdToRmb);
  if (currency === "USD") {
    if (!Number.isFinite(usdToRmb) || usdToRmb <= 0) return 0;
    return amount * usdToRmb;
  }
  return 0;
}

/** Inverse of `adminAmountToCanonicalRmb` for edit forms (approximate for display inputs). */
export function canonicalRmbToAdminAmount(rmb: number, currency: DisplayCurrency, s: FxRatesInput): number {
  if (!Number.isFinite(rmb) || rmb < 0) return 0;
  if (currency === "CNY") return rmb;
  const rmbToGhs = Number(s.rmbToGhs);
  if (currency === "GHS") {
    if (!Number.isFinite(rmbToGhs) || rmbToGhs <= 0) return Math.round(rmb / DEFAULT_SETTINGS.rmbToGhs);
    return rmb / rmbToGhs;
  }
  const usdToRmb = Number(s.usdToRmb);
  if (currency === "USD") {
    if (!Number.isFinite(usdToRmb) || usdToRmb <= 0) return rmb / DEFAULT_SETTINGS.usdToRmb;
    return rmb / usdToRmb;
  }
  return rmb;
}

export function formatConverted(amount: number, currency: DisplayCurrency): string {
  const code = currency === "CNY" ? "CNY" : currency;
  try {
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      // CNY/RMB is clearer in this product with code-style formatting (e.g. "CNY 10,000.00")
      currencyDisplay: code === "CNY" ? "code" : "symbol",
      maximumFractionDigits: code === "GHS" ? 0 : 2,
    }).format(amount);
    // Normalize NBSP and enforce a single visible space between currency marker and number.
    return formatted
      .replace(/\u00A0/g, " ")
      .replace(/([^\d\s-])(\d)/g, "$1 $2")
      .replace(/([A-Z]{3})(\d)/g, "$1 $2")
      .replace(/\s{2,}/g, " ")
      .trim();
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

export function formatVehiclePriceFromRmb(basePriceRmb: number, target: DisplayCurrency, settings: FxRatesInput): string {
  return formatConverted(getCarDisplayPrice(basePriceRmb, target, settings), target);
}

/** Chain USD→RMB→GHS: `(usdToRmb) / rmbToGhs` GHS per 1 USD (compare to stored `usdToGhs` direct rate). */
export function deriveUsdToGhs(s: { usdToRmb: unknown; rmbToGhs: unknown }): number {
  const usdToRmb = Number(s.usdToRmb);
  const div = Number(s.rmbToGhs);
  if (!Number.isFinite(usdToRmb) || !Number.isFinite(div) || div <= 0) return 0;
  return usdToRmb / div;
}

export type ExchangeRateSummary = {
  usdToRmb: number;
  /** Divisor D: GHS = RMB / D */
  rmbToGhs: number;
  usdToGhsStored: number;
  /** USD→RMB→GHS chain: usdToRmb / rmbToGhs */
  usdToGhsDerived: number;
  /** RMB per 1 GHS (multiply GHS by this to get RMB). */
  rmbPerGhs: number;
};

export function getExchangeRateSummary(settings: {
  usdToRmb: unknown;
  rmbToGhs: unknown;
  usdToGhs: unknown;
}): ExchangeRateSummary {
  const usdToRmb = Number(settings.usdToRmb);
  const rmbToGhs = Number(settings.rmbToGhs);
  const rmbPerGhs = Number.isFinite(rmbToGhs) && rmbToGhs > 0 ? rmbToGhs : 0;
  return {
    usdToRmb,
    rmbToGhs,
    usdToGhsStored: Number(settings.usdToGhs),
    usdToGhsDerived: deriveUsdToGhs({ usdToRmb, rmbToGhs }),
    rmbPerGhs,
  };
}
