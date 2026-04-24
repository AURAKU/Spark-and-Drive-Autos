import type { VehicleQueryPayload } from "@/lib/parts-finder/identifier-crypto";
import { normalizePartsQuery } from "@/lib/parts-finder/normalize-query";
import { rankAndSummarizeExternal } from "@/lib/parts-finder/rank-and-summarize";
import type { ParsedSearchHit, SearchPipelineResultRow } from "@/lib/parts-finder/search-types";
import type { NormalizedPartsQuery } from "@/lib/parts-finder/normalize-query";

export function rankPartsFinderCandidates(
  payload: VehicleQueryPayload | NormalizedPartsQuery,
  candidates: ParsedSearchHit[],
  userId: string,
  learning?: {
    signatureBoostMap: Map<string, number>;
    similarSignatureBoostMap?: Map<string, number>;
    exactPositive: number;
    exactLikely: number;
    exactRejected: number;
    similarPositive?: number;
    similarLikely?: number;
    similarRejected?: number;
  },
): SearchPipelineResultRow[] {
  const normalized = "retrieval" in payload ? payload : normalizePartsQuery(payload);
  return rankAndSummarizeExternal(normalized, candidates, userId, learning);
}
