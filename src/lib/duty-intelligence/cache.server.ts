import "server-only";

import { createHash } from "node:crypto";

import { DUTY_INTELLIGENCE_FORMULA_VERSION } from "./formula-version";

import {
  dutyCacheGet,
  dutyCacheInvalidate,
  dutyCacheKey,
  dutyCacheSet,
} from "./cache-memory";

export { dutyCacheGet, dutyCacheInvalidate, dutyCacheKey, dutyCacheSet } from "./cache-memory";

export type EstimateFingerprintInput = {
  make: string;
  model: string;
  year: number;
  fuelType: string;
  fobAmount: number;
  fobCurrency: string;
  hsCode?: string;
  profileId?: string;
  ruleSetVersion?: string;
  fxRate?: number;
  fxEffectiveDate?: string;
  engineCc?: number;
  powerKw?: number;
  vehicleCategory?: string;
  freightGhs?: number;
  insuranceGhs?: number;
};

export function buildEstimateFingerprint(input: EstimateFingerprintInput): string {
  const payload = {
    formulaVersion: DUTY_INTELLIGENCE_FORMULA_VERSION,
    make: input.make.trim().toLowerCase(),
    model: input.model.trim().toLowerCase(),
    year: input.year,
    fuelType: input.fuelType,
    fobAmount: input.fobAmount,
    fobCurrency: input.fobCurrency,
    hsCode: input.hsCode ?? "",
    profileId: input.profileId ?? "",
    ruleSetVersion: input.ruleSetVersion ?? "",
    fxRate: input.fxRate ?? "",
    fxEffectiveDate: input.fxEffectiveDate ?? "",
    engineCc: input.engineCc ?? "",
    powerKw: input.powerKw ?? "",
    vehicleCategory: input.vehicleCategory ?? "",
    freightGhs: input.freightGhs ?? "",
    insuranceGhs: input.insuranceGhs ?? "",
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 32);
}

export function estimateCacheKey(fingerprint: string): string {
  return dutyCacheKey("estimate", fingerprint);
}

export function profileCacheKey(profileId: string, ruleSetVersion: string): string {
  return dutyCacheKey("profile", profileId, ruleSetVersion);
}

export function fxCacheKey(countryConfigId: string, currency: string, effectiveDate: string): string {
  return dutyCacheKey("fx", countryConfigId, currency, effectiveDate);
}
