import type { GlobalCurrencySettings, PartOrigin } from "@prisma/client";
import type { DisplayCurrency, FxRatesInput } from "@/lib/currency";
import { adminAmountToCanonicalRmb, convertRmbTo, getCarDisplayPrice } from "@/lib/currency";

export function allowedPartCurrencies(origin: PartOrigin): DisplayCurrency[] {
  if (origin === "GHANA") return ["GHS"];
  return ["GHS", "USD", "CNY"];
}

/**
 * Stored `Part.basePriceRmb` value such that `convertRmbTo(..., "GHS")` equals integer `ghs` at current divisor.
 * Ghana listings are authored in GHS; we persist this canonical RMB for one code path with China-origin parts.
 */
export function ghsSellingPriceToCanonicalBasePriceRmb(ghs: number, rates: FxRatesInput): number {
  const div = Number(rates.rmbToGhs);
  if (!Number.isFinite(div) || div <= 0) return 0;
  const g = Math.max(0, Math.round(ghs));
  return g * div;
}

/** Persists list price from admin form: Ghana = GHS input; China = RMB input. */
export function resolvePartListPricingFromForm(
  origin: PartOrigin,
  input: { basePriceRmb?: number; basePriceGhs?: number },
  settings: Pick<GlobalCurrencySettings, "usdToRmb" | "rmbToGhs" | "usdToGhs">,
): { basePriceRmb: number; priceGhs: number } {
  const fx: FxRatesInput = {
    usdToRmb: Number(settings.usdToRmb),
    rmbToGhs: Number(settings.rmbToGhs),
    usdToGhs: Number(settings.usdToGhs),
  };
  if (origin === "GHANA") {
    const ghs = Math.round(input.basePriceGhs ?? 0);
    const rmb = ghsSellingPriceToCanonicalBasePriceRmb(ghs, fx);
    return { basePriceRmb: rmb, priceGhs: ghs };
  }
  const rmb = input.basePriceRmb ?? 0;
  return { basePriceRmb: rmb, priceGhs: getCarDisplayPrice(rmb, "GHS", fx) };
}

/** Admin list price: any of GHS / USD / CNY → canonical `basePriceRmb` + integer reference `priceGhs`. */
export function resolvePartListPriceFromAdminInput(
  input: { sellingPriceAmount: number; sellingPriceCurrency: DisplayCurrency },
  settings: Pick<GlobalCurrencySettings, "usdToRmb" | "rmbToGhs" | "usdToGhs">,
): { basePriceRmb: number; priceGhs: number } {
  const fx: FxRatesInput = {
    usdToRmb: Number(settings.usdToRmb),
    rmbToGhs: Number(settings.rmbToGhs),
    usdToGhs: Number(settings.usdToGhs),
  };
  const basePriceRmb = adminAmountToCanonicalRmb(input.sellingPriceAmount, input.sellingPriceCurrency, fx);
  return { basePriceRmb, priceGhs: Math.round(getCarDisplayPrice(basePriceRmb, "GHS", fx)) };
}

/**
 * Part storefront pricing: derived from `basePriceRmb` + admin FX (for Ghana, `basePriceRmb` is set from GHS on save).
 * `priceGhs` on the row is synced on save for admin reference.
 */
export function getPartDisplayPrice(
  input: {
    origin: PartOrigin;
    basePriceRmb: number;
    /** @deprecated Ignored — kept for call-site compatibility during refactors */
    priceGhs?: number;
  },
  target: DisplayCurrency,
  rates: FxRatesInput,
): { amount: number; currency: DisplayCurrency } {
  const allowed = allowedPartCurrencies(input.origin);
  const safeCurrency = allowed.includes(target) ? target : "GHS";
  return { amount: convertRmbTo(input.basePriceRmb, safeCurrency, rates), currency: safeCurrency };
}
