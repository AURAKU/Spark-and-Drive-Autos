import type { ExternalCandidate } from "@/lib/parts-finder/external/types";
import { ingestExternalCandidates } from "@/lib/parts-finder/external/web-ingest";
import type { NormalizedPartsQuery } from "@/lib/parts-finder/normalize-query";

type ExternalDiscoveryAdapter = {
  name: string;
  isAvailable: () => boolean;
  discover: (queries: string[], normalized: NormalizedPartsQuery, trace?: { jobId?: string }) => Promise<ExternalCandidate[]>;
};

const serperAdapter: ExternalDiscoveryAdapter = {
  name: "serper",
  isAvailable: () => Boolean(process.env.SERPER_API_KEY),
  discover: async (_queries, normalized, trace) => ingestExternalCandidates(normalized, trace),
};

const previewAdapter: ExternalDiscoveryAdapter = {
  name: "preview",
  isAvailable: () => true,
  discover: async (queries) =>
    queries.slice(0, 8).map((query) => ({
      title: `${query} OEM and aftermarket references`,
      snippet: "Aggregated evidence candidate. Verify fitment and OEM numbers before purchase.",
      sourceHint: "search-index",
      ingestionSource: "FALLBACK_PREVIEW",
      thumbnailUrl: null,
      oemReferences: [],
      alternateReferences: [],
      fitmentClues: [],
      sourceIdentity: "preview",
      sourceUrl: null,
      description: "Deterministic preview result",
      imageHints: [],
    })),
};

const ADAPTERS: ExternalDiscoveryAdapter[] = [serperAdapter, previewAdapter];
const EXTERNAL_CACHE_TTL_MS = 2 * 60 * 1000;
const externalCache = new Map<string, { expiresAt: number; hits: ExternalCandidate[] }>();
const externalInFlight = new Map<string, Promise<ExternalCandidate[]>>();

function externalCacheKey(queries: string[], normalized: NormalizedPartsQuery) {
  return JSON.stringify({
    queries,
    vehicle: {
      brand: normalized.brand,
      model: normalized.model,
      year: normalized.year,
      engine: normalized.engine,
      trim: normalized.trim,
    },
    intent: normalized.partIntent,
  });
}

export async function discoverExternalPartsEvidence(
  queries: string[],
  normalized: NormalizedPartsQuery,
  trace?: { jobId?: string },
): Promise<ExternalCandidate[]> {
  const key = externalCacheKey(queries, normalized);
  const now = Date.now();
  const cached = externalCache.get(key);
  if (cached && cached.expiresAt > now) return cached.hits;
  const inFlight = externalInFlight.get(key);
  if (inFlight) return inFlight;

  const task = (async () => {
  for (const adapter of ADAPTERS) {
    if (!adapter.isAvailable()) continue;
    const hits = await adapter.discover(queries, normalized, trace);
      if (hits.length > 0) {
        externalCache.set(key, { expiresAt: Date.now() + EXTERNAL_CACHE_TTL_MS, hits });
        return hits;
      }
  }
  return [];
  })();
  externalInFlight.set(key, task);
  try {
    return await task;
  } finally {
    externalInFlight.delete(key);
  }
}
