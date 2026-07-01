import type { DutyCountryCode } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { dutyCacheGet, dutyCacheKey, dutyCacheSet } from "./cache";
import type { CountryConfigBundle, LoadedChargeTemplate, LoadedFormulaRule, LoadedHsCode } from "./types";

function toNum(v: unknown): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

export class DutyConfigNotFoundError extends Error {
  readonly code = "CONFIG_UNAVAILABLE" as const;
  readonly countryCode: DutyCountryCode;

  constructor(countryCode: DutyCountryCode) {
    super(`Duty country config not found for ${countryCode}`);
    this.name = "DutyConfigNotFoundError";
    this.countryCode = countryCode;
  }
}

async function fetchCountryBundle(countryCode: DutyCountryCode): Promise<CountryConfigBundle | null> {
  const country = await prisma.dutyCountryConfig.findUnique({
    where: { countryCode },
    include: {
      formulaRules: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] },
      hsCodes: { where: { active: true } },
      chargeTemplates: { where: { active: true } },
      shippingLines: { where: { active: true }, orderBy: { name: "asc" } },
      calibrations: true,
    },
  });

  if (!country) return null;

  const formulaRules: LoadedFormulaRule[] = country.formulaRules.map((r) => ({
    id: r.id,
    code: r.code,
    label: r.label,
    basis: r.basis,
    rateType: r.rateType,
    rateValue: toNum(r.rateValue),
    conditionsJson: r.conditionsJson as Record<string, unknown> | null,
    formulaNote: r.formulaNote,
    version: r.version,
    sortOrder: r.sortOrder,
  }));

  const hsCodes: LoadedHsCode[] = country.hsCodes.map((h) => ({
    hsCode: h.hsCode,
    description: h.description,
    dutyRateHint: h.dutyRateHint != null ? toNum(h.dutyRateHint) : null,
  }));

  const chargeTemplates: LoadedChargeTemplate[] = country.chargeTemplates.map((c) => ({
    id: c.id,
    category: c.category,
    subcategory: c.subcategory,
    label: c.label,
    amountGhs: c.amountGhs != null ? toNum(c.amountGhs) : null,
    calculationType: c.calculationType,
    rateValue: c.rateValue != null ? toNum(c.rateValue) : null,
    shippingLineId: c.shippingLineId,
    sampleCount: c.sampleCount,
  }));

  const calibrationFactors: Record<string, number> = {};
  for (const cal of country.calibrations) {
    calibrationFactors[cal.category] = toNum(cal.factor);
  }

  return {
    countryConfigId: country.id,
    countryCode: country.countryCode,
    currency: country.currency,
    formulaRules,
    hsCodes,
    chargeTemplates,
    calibrationFactors,
    shippingLines: country.shippingLines.map((s) => ({ id: s.id, code: s.code, name: s.name })),
  };
}

/** Load country config — returns null instead of throwing when missing. */
export async function loadCountryConfigSafe(
  countryCode: DutyCountryCode = "GH",
): Promise<CountryConfigBundle | null> {
  const cacheKey = dutyCacheKey("config", countryCode);
  const cached = await dutyCacheGet<CountryConfigBundle>(cacheKey);
  if (cached) return cached;

  const bundle = await fetchCountryBundle(countryCode);
  if (bundle) await dutyCacheSet(cacheKey, bundle);
  return bundle;
}

/** Load country config — throws DutyConfigNotFoundError when missing (internal use after health check). */
export async function loadCountryConfig(countryCode: DutyCountryCode = "GH"): Promise<CountryConfigBundle> {
  const bundle = await loadCountryConfigSafe(countryCode);
  if (!bundle) throw new DutyConfigNotFoundError(countryCode);
  return bundle;
}

export async function getLatestExchangeRate(params: {
  countryConfigId: string;
  fromCurrency: string;
  toCurrency?: string;
}): Promise<{ rate: number; source: string; effectiveDate: Date; id: string } | null> {
  const toCurrency = params.toCurrency ?? "GHS";
  const row = await prisma.dutyExchangeRate.findFirst({
    where: {
      countryConfigId: params.countryConfigId,
      fromCurrency: params.fromCurrency.toUpperCase(),
      toCurrency: toCurrency.toUpperCase(),
    },
    orderBy: { effectiveDate: "desc" },
  });
  if (!row) return null;
  return {
    id: row.id,
    rate: toNum(row.rate),
    source: row.source,
    effectiveDate: row.effectiveDate,
  };
}

/** Supported FOB currencies with fallback rates when duty exchange table has no row. */
export const SUPPORTED_FOB_CURRENCIES = ["USD", "CNY", "EUR", "GBP", "AED", "JPY", "KRW", "GHS"] as const;

export type SupportedFobCurrency = (typeof SUPPORTED_FOB_CURRENCIES)[number];

export function isSupportedFobCurrency(c: string): c is SupportedFobCurrency {
  return (SUPPORTED_FOB_CURRENCIES as readonly string[]).includes(c.toUpperCase());
}
