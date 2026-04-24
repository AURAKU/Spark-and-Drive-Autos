import { generateEvidenceBoundedAiSummary } from "@/lib/parts-finder/ai-summary";
import type { SearchPipelineResultRow } from "@/lib/parts-finder/search-types";
import type { ConfidenceBreakdown, StructuredSummary } from "@/lib/parts-finder/search-types";

function describeUncertainty(row: SearchPipelineResultRow): string[] {
  const notes: string[] = [];
  if (row.confidenceLabel === "NEEDS_VERIFICATION") {
    notes.push("Evidence quality is not strong enough to confirm exact fitment.");
  }
  if ((row.oemCodes?.length ?? 0) === 0) {
    notes.push("No strong OEM references were extracted from evidence text.");
  }
  if (row.scoreBreakdown?.yearMismatchPenalty && row.scoreBreakdown.yearMismatchPenalty > 0) {
    notes.push("Year fitment consistency is uncertain across candidate evidence.");
  }
  if (row.scoreBreakdown?.fitmentContradictionPenalty && row.scoreBreakdown.fitmentContradictionPenalty > 0) {
    notes.push("Some fitment qualifiers were missing or contradictory.");
  }
  return notes;
}

function compareCandidates(rows: SearchPipelineResultRow[]): string[] {
  if (rows.length < 2) return ["Top result selected as highest deterministic evidence score."];
  const [first, second] = rows;
  const delta = first.confidenceScore - second.confidenceScore;
  const reasons: string[] = [];
  if ((first.scoreBreakdown?.oemConsistency ?? 0) > (second.scoreBreakdown?.oemConsistency ?? 0)) {
    reasons.push("Top candidate showed stronger OEM reference consistency.");
  }
  if ((first.scoreBreakdown?.vehicleFit ?? 0) > (second.scoreBreakdown?.vehicleFit ?? 0)) {
    reasons.push("Top candidate aligned better with vehicle fit clues.");
  }
  if (delta >= 8) {
    reasons.push("Score separation indicates materially better evidence quality.");
  }
  return reasons.length > 0 ? reasons : ["Top candidate narrowly outranked alternatives on combined evidence."];
}

export function summarizePartsFinderResults(
  rows: SearchPipelineResultRow[],
  confidence: ConfidenceBreakdown | null,
): StructuredSummary {
  if (rows.length === 0) {
    return {
      headline: "No clear match found",
      fitmentExplanation: "Add VIN/chassis or include brand, model, year, and part description for stronger matching.",
      oemConfidenceText: "OEM confidence unavailable",
      aftermarketConfidenceText: "Aftermarket confidence unavailable",
      warnings: ["No reliable candidates were detected in current evidence."],
      userSafeSummary: "No validated match detected. Provide more precise vehicle and part details.",
      whyTopRanked: ["No candidate met minimum evidence threshold."],
      uncertaintyNotes: ["Results are inconclusive and require manual verification."],
    };
  }
  const best = rows[0];
  const compared = compareCandidates(rows);
  const uncertaintyNotes = describeUncertainty(best);
  const aiSummary = generateEvidenceBoundedAiSummary({ ranked: rows });
  const safeOemCodes = best.oemCodes.map((x) => x.code).slice(0, 3);
  const userSafeSummary =
    best.confidenceLabel === "VERIFIED_MATCH"
      ? `${best.candidatePartName} ranks highest with strong fitment and OEM-text consistency.`
      : `${best.candidatePartName} is a lead candidate but still requires fitment confirmation before order.`;
  return {
    headline: best.candidatePartName,
    fitmentExplanation: best.fitmentNotes ?? "Fitment requires manual verification.",
    oemConfidenceText: confidence ? `${confidence.oemMatchConfidence}%` : "Unavailable",
    aftermarketConfidenceText: confidence ? `${confidence.aftermarketAlternativeConfidence}%` : "Unavailable",
    warnings: best.safetyFlagManualReview
      ? ["Manual verification recommended before quoting or ordering."]
      : [],
    userSafeSummary:
      safeOemCodes.length > 0
        ? `${aiSummary.userSafeSummary ?? userSafeSummary} Observed refs: ${safeOemCodes.join(", ")}.`
        : (aiSummary.userSafeSummary ?? userSafeSummary),
    whyTopRanked: aiSummary.whyTopRanked ?? compared,
    uncertaintyNotes: aiSummary.uncertaintyNotes?.length ? aiSummary.uncertaintyNotes : uncertaintyNotes,
  };
}
