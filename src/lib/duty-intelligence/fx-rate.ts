import { engineError } from "./errors";

export type FxRateResolution = {
  rate: number;
  source: string;
  fromCurrency: string;
  effectiveDate: string;
};

export function resolveFxRate(params: {
  fobForeign: number;
  fobGhs: number;
  fxRateOverride?: number;
  source?: string;
  effectiveDate?: Date;
}): FxRateResolution {
  if (params.fxRateOverride != null && params.fxRateOverride > 0) {
    return {
      rate: params.fxRateOverride,
      source: "MANUAL_OVERRIDE",
      fromCurrency: "USD",
      effectiveDate: (params.effectiveDate ?? new Date()).toISOString(),
    };
  }

  if (params.fobForeign <= 0) {
    throw engineError("MISSING_FX_RATE", "FOB foreign amount must be positive to derive FX rate");
  }

  const rate = params.fobGhs / params.fobForeign;
  if (!Number.isFinite(rate) || rate <= 0) {
    throw engineError("MISSING_FX_RATE", "Unable to resolve FX rate from FOB values");
  }

  return {
    rate,
    source: params.source ?? "CUSTOMS",
    fromCurrency: "USD",
    effectiveDate: (params.effectiveDate ?? new Date()).toISOString(),
  };
}

export function requireFxRate(rate: number | null | undefined): number {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) {
    throw engineError("MISSING_FX_RATE", "Assessment-date FX rate is required");
  }
  return rate;
}
