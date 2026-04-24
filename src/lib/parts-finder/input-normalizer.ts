import type { VehicleQueryPayload } from "@/lib/parts-finder/identifier-crypto";
import { normalizePartsQuery } from "@/lib/parts-finder/normalize-query";
import { partsFinderInputSchema } from "@/lib/parts-finder/schemas";

const NORMALIZED_CACHE_TTL_MS = 5 * 60 * 1000;
const normalizedCache = new Map<string, { expiresAt: number; normalized: ReturnType<typeof normalizePartsQuery>; cleanedPayload: ReturnType<typeof partsFinderInputSchema.parse> }>();

function payloadCacheKey(payload: VehicleQueryPayload): string {
  return JSON.stringify({
    vin: payload.vin ?? null,
    chassis: payload.chassis ?? null,
    brand: payload.brand ?? null,
    model: payload.model ?? null,
    year: payload.year ?? null,
    engine: payload.engine ?? null,
    trim: payload.trim ?? null,
    partDescription: payload.partDescription ?? null,
    partImage: payload.partImage ?? null,
  });
}

export function normalizePartsFinderInput(payload: VehicleQueryPayload) {
  const key = payloadCacheKey(payload);
  const now = Date.now();
  const cached = normalizedCache.get(key);
  if (cached && cached.expiresAt > now) {
    return {
      normalized: cached.normalized,
      cleanedPayload: cached.cleanedPayload,
    };
  }
  const parsed = partsFinderInputSchema.parse(payload);
  const normalized = normalizePartsQuery(parsed);
  normalizedCache.set(key, {
    expiresAt: now + NORMALIZED_CACHE_TTL_MS,
    normalized,
    cleanedPayload: parsed,
  });
  return {
    normalized,
    cleanedPayload: parsed,
  };
}
