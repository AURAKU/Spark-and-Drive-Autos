import { prisma } from "@/lib/prisma";

import { getLatestExchangeRate } from "../config-loader";
import type { CalculationLineItem, DutyCalculationInput } from "../types";

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

  const customs = await getLatestExchangeRate({ countryConfigId, fromCurrency, toCurrency: "GHS" });
  if (customs) {
    notes.push(`Customs exchange rate: 1 ${fromCurrency} = ${customs.rate} GHS (${customs.source}, ${customs.effectiveDate.toISOString().slice(0, 10)})`);
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

  // Fallback to global currency settings
  const global = await prisma.globalCurrencySettings.findUnique({ where: { id: "default" } });
  if (!global) throw new Error("No exchange rate available");

  let rate = 1;
  if (fromCurrency === "USD") rate = Number(global.usdToGhs);
  else if (fromCurrency === "CNY" || fromCurrency === "RMB") rate = 1 / Number(global.rmbToGhs);
  else throw new Error(`Unsupported currency: ${fromCurrency}`);

  notes.push(`Global currency settings fallback: 1 ${fromCurrency} = ${rate} GHS`);
  lineItems.push({
    code: "EXCHANGE_RATE",
    label: `Exchange rate (${fromCurrency} → GHS)`,
    category: "FOB",
    amountGhs: rate,
    basis: "GlobalCurrencySettings",
    formula: `1 ${fromCurrency} × ${rate}`,
    rate,
    rateType: "EXCHANGE",
    source: "CONFIG",
  });

  return {
    rate,
    source: "GLOBAL_CURRENCY",
    fromCurrency,
    effectiveDate: global.updatedAt.toISOString(),
    lineItems,
    notes,
  };
}

export function computeFobGhs(fobAmount: number, rate: number): number {
  return Math.round(fobAmount * rate * 100) / 100;
}

export function computeFreightInsurance(input: DutyCalculationInput): {
  freightGhs: number;
  insuranceGhs: number;
  otherGhs: number;
} {
  return {
    freightGhs: input.shipping.freightGhs ?? 0,
    insuranceGhs: input.shipping.insuranceGhs ?? 0,
    otherGhs: input.shipping.otherShippingChargesGhs ?? 0,
  };
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
  // Ghana: customs value typically equals CIF for vehicle imports
  return cifGhs;
}
