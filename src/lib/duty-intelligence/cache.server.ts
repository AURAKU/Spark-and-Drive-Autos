import "server-only";

import { createHash } from "node:crypto";

import { DUTY_INTELLIGENCE_FORMULA_VERSION } from "./formula-version";

type CacheEntry<T> = { value: T; expiresAt: number; fingerprint: string };

const memoryCache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 5 * 60 * 1000;

export async function dutyCacheGet<T>(key: string, fingerprint?: string): Promise<T | null> {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  if (fingerprint && entry.fingerprint !== fingerprint) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value as T;
}

export async function dutyCacheSet<T>(
  key: string,
  value: T,
  opts?: { ttlMs?: number; fingerprint?: string },
): Promise<void> {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + (opts?.ttlMs ?? DEFAULT_TTL_MS),
    fingerprint: opts?.fingerprint ?? "",
  });
}

export async function dutyCacheInvalidate(prefix: string): Promise<void> {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key);
  }
}

export function dutyCacheKey(...parts: string[]): string {
  return `duty:${parts.join(":")}`;
}

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
