import type { DisplayCurrency, FxRatesInput } from "@/lib/currency";
import { convertRmbTo } from "@/lib/currency";
import type { PartOrigin } from "@prisma/client";

export function allowedPartCurrencies(origin: PartOrigin): DisplayCurrency[] {
  if (origin === "GHANA") return ["GHS"];
  return ["GHS", "USD", "CNY"];
}

/**
 * Part storefront pricing: always derived from `basePriceRmb` + admin FX.
 * `priceGhs` on the row is a legacy cache (synced on save) and is not used here.
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
