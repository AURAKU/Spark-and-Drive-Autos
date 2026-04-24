import type { ConfidenceBreakdown, SearchPipelineResultRow, StructuredSummary } from "@/lib/parts-finder/search-types";

/** Customer-facing ranked row: no score breakdown or raw metadata blobs. */
export type UserSafeRankedResult = {
  candidatePartName: string;
  confidenceLabel: SearchPipelineResultRow["confidenceLabel"];
  confidenceScore: number;
  summaryExplanation: string;
  partFunctionSummary?: string;
  fitmentNotes: string | null;
  catalogPartId: string | null;
  oemCodes: SearchPipelineResultRow["oemCodes"];
  fitments: SearchPipelineResultRow["fitments"];
  images: SearchPipelineResultRow["images"];
  ingestionSource: string;
  safetyFlagManualReview: boolean;
};

export function toUserSafeRankedResults(rows: SearchPipelineResultRow[]): UserSafeRankedResult[] {
  return rows.map((row) => ({
    candidatePartName: row.candidatePartName,
    confidenceLabel: row.confidenceLabel,
    confidenceScore: row.confidenceScore,
    summaryExplanation: row.summaryExplanation,
    partFunctionSummary: row.partFunctionSummary,
    fitmentNotes: row.fitmentNotes,
    catalogPartId: row.catalogPartId,
    oemCodes: row.oemCodes,
    fitments: row.fitments,
    images: row.images,
    ingestionSource: row.ingestionSource,
    safetyFlagManualReview: row.safetyFlagManualReview,
  }));
}

/** Summary fields safe to show to members; excludes any future internal-only keys. */
export function toUserSafeSummary(summary: StructuredSummary): StructuredSummary {
  return {
    headline: summary.headline,
    fitmentExplanation: summary.fitmentExplanation,
    oemConfidenceText: summary.oemConfidenceText,
    aftermarketConfidenceText: summary.aftermarketConfidenceText,
    warnings: summary.warnings,
    userSafeSummary: summary.userSafeSummary,
    whyTopRanked: summary.whyTopRanked,
    uncertaintyNotes: summary.uncertaintyNotes,
  };
}

export function toUserSafeConfidence(confidence: ConfidenceBreakdown | null): ConfidenceBreakdown | null {
  if (!confidence) return null;
  return {
    oemMatchConfidence: confidence.oemMatchConfidence,
    aftermarketAlternativeConfidence: confidence.aftermarketAlternativeConfidence,
    fitmentConfidence: confidence.fitmentConfidence,
    overallConfidence: confidence.overallConfidence,
    label: confidence.label,
  };
}

/**
 * Ensures API responses return a member-safe metadata payload.
 * Keeps known safe fields and strips internal-only diagnostics.
 */
export function buildUserSafeSessionPayload(
  metadata: unknown,
): unknown {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return metadata;
  }

  const source = metadata as Record<string, unknown>;
  const blockedKeys = new Set([
    "internalDebug",
    "rawEvidence",
    "rankDiagnostics",
    "scoringFactors",
    "adminOnly",
  ]);

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!blockedKeys.has(key)) {
      safe[key] = value;
    }
  }
  return safe;
}
