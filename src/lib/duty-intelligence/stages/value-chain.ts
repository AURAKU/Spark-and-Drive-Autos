import { prisma } from "@/lib/prisma";
import { fallbackGlobalCurrencySettings } from "@/lib/currency";

import { getLatestExchangeRate, isSupportedFobCurrency } from "../config-loader";
import type { CalculationLineItem, DutyCalculationInput } from "../types";

/** Approximate GHS rates for currencies not in duty exchange table — updated via admin FX. */
const FALLBACK_RATES_TO_GHS: Record<string, number> = {
  USD: 11.65,
  CNY: 1.7,
  EUR: 12.8,
  GBP: 14.9,
  AED: 3.17,
  JPY: 0.078,
  KRW: 0.0087,
  GHS: 1,
};

export async function resolveExchangeRate(params: {
  countryConfigId: string;
  input: DutyCalculationInput;
}): Promise<{
  rate: number;
  source: string;
  fromCurrency: string;
  effectiveDate: string;
  lineItems: CalculationLineItem[];
  notes: string[];
}> {
  const { input, countryConfigId } = params;
  const fromCurrency = input.purchase.fobCurrency.toUpperCase();
  const notes: string[] = [];
  const lineItems: CalculationLineItem[] = [];

  if (input.exchangeRateOverride != null) {
    notes.push(`Manual exchange rate override: 1 ${fromCurrency} = ${input.exchangeRateOverride} GHS`);
    return {
      rate: input.exchangeRateOverride,
      source: "MANUAL_OVERRIDE",
      fromCurrency,
      effectiveDate: new Date().toISOString(),
      lineItems,
      notes,
    };
  }

  if (fromCurrency === "GHS") {
    return {
      rate: 1,
      source: "IDENTITY",
      fromCurrency: "GHS",
      effectiveDate: new Date().toISOString(),
      lineItems,
      notes: ["FOB already in GHS — no conversion required."],
    };
  }

  if (!isSupportedFobCurrency(fromCurrency)) {
    throw new Error(`Unsupported currency: ${fromCurrency}`);
  }

  const customs = await getLatestExchangeRate({ countryConfigId, fromCurrency, toCurrency: "GHS" });
  if (customs) {
    notes.push(
      `Exchange rate: 1 ${fromCurrency} = ${customs.rate} GHS (${customs.source}, ${customs.effectiveDate.toISOString().slice(0, 10)})`,
    );
    lineItems.push({
      code: "EXCHANGE_RATE",
      label: `Exchange rate (${fromCurrency} → GHS)`,
      category: "FOB",
      amountGhs: customs.rate,
      basis: `${fromCurrency} to GHS`,
      formula: `1 ${fromCurrency} × ${customs.rate} = GHS`,
      rate: customs.rate,
      rateType: "EXCHANGE",
      source: "CONFIG",
    });
    return {
      rate: customs.rate,
      source: customs.source,
      fromCurrency,
      effectiveDate: customs.effectiveDate.toISOString(),
      lineItems,
      notes,
    };
  }

  const global = await prisma.globalCurrencySettings.findUnique({ where: { id: "default" } }).catch(() => null);
  const settings = global ?? fallbackGlobalCurrencySettings();

  let rate = FALLBACK_RATES_TO_GHS[fromCurrency] ?? 1;
  if (fromCurrency === "USD") rate = Number(settings.usdToGhs);
  else if (fromCurrency === "CNY") rate = 1 / Number(settings.rmbToGhs);

  notes.push(`Cached exchange rate fallback: 1 ${fromCurrency} = ${rate} GHS`);
  lineItems.push({
    code: "EXCHANGE_RATE",
    label: `Exchange rate (${fromCurrency} → GHS)`,
    category: "FOB",
    amountGhs: rate,
    basis: "GlobalCurrencySettings / cached fallback",
    formula: `1 ${fromCurrency} × ${rate}`,
    rate,
    rateType: "EXCHANGE",
    source: "CONFIG",
  });

  return {
    rate,
    source: "GLOBAL_CURRENCY",
    fromCurrency,
    effectiveDate: settings.updatedAt.toISOString(),
    lineItems,
    notes,
  };
}

export function computeFobGhs(fobAmount: number, rate: number): number {
  return Math.round(fobAmount * rate * 100) / 100;
}

export function computeCif(params: {
  fobGhs: number;
  freightGhs: number;
  insuranceGhs: number;
  otherGhs: number;
  override?: number;
}): number {
  if (params.override != null) return Math.round(params.override * 100) / 100;
  return Math.round((params.fobGhs + params.freightGhs + params.insuranceGhs + params.otherGhs) * 100) / 100;
}

export function computeCustomsValue(cifGhs: number): number {
  return cifGhs;
}
