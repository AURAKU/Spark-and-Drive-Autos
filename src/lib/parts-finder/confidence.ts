import type { PartMatchConfidenceLabel } from "@/lib/parts-finder/search-types";
import type { SearchPipelineResultRow, ConfidenceBreakdown } from "@/lib/parts-finder/search-types";

export function mapScoreToConfidence(score: number): PartMatchConfidenceLabel {
  if (score >= 88) return "VERIFIED_MATCH";
  if (score >= 70) return "LIKELY_MATCH";
  return "NEEDS_VERIFICATION";
}

export function calculateConfidenceBreakdown(row: SearchPipelineResultRow): ConfidenceBreakdown {
  const rawPenalty =
    (row.scoreBreakdown?.fitmentContradictionPenalty ?? 0) +
    (row.scoreBreakdown?.yearMismatchPenalty ?? 0) +
    (row.scoreBreakdown?.weakContextPenalty ?? 0);
  const base = Math.max(0, Math.min(100, row.confidenceScore - Math.min(14, rawPenalty)));
  const fitment = row.fitments.some((f) => f.brand && f.model) ? Math.min(100, base + 4) : Math.max(35, base - 18);
  const oem = row.oemCodes.length > 0 ? Math.min(100, base + 6) : Math.max(20, base - 25);
  const aftermarket = Math.max(15, Math.min(95, base - (row.oemCodes.length > 0 ? 10 : -5)));
  return {
    oemMatchConfidence: oem,
    aftermarketAlternativeConfidence: aftermarket,
    fitmentConfidence: fitment,
    overallConfidence: base,
    label: mapScoreToConfidence(base),
  };
}
