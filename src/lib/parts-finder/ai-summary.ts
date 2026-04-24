import type { SearchPipelineResultRow, StructuredSummary } from "@/lib/parts-finder/search-types";

type AiSummaryInput = {
  ranked: SearchPipelineResultRow[];
};

type AiSummaryOutput = Pick<StructuredSummary, "userSafeSummary" | "whyTopRanked" | "uncertaintyNotes"> & {
  internalSummary: string;
};

function uncertaintyNotesFor(row: SearchPipelineResultRow): string[] {
  const notes: string[] = [];
  if (row.confidenceLabel === "NEEDS_VERIFICATION") notes.push("Confidence remains below exact-fit threshold.");
  if ((row.oemCodes?.length ?? 0) === 0) notes.push("OEM references were not strong enough for certainty.");
  if ((row.scoreBreakdown?.yearMismatchPenalty ?? 0) > 0) notes.push("Year fitment mismatch signals were detected.");
  if ((row.scoreBreakdown?.fitmentContradictionPenalty ?? 0) > 0) notes.push("Fitment qualifiers conflicted with available evidence.");
  return notes;
}

/**
 * AI-assisted summary bounded strictly by ranked evidence.
 * This utility never invents identifiers and never upgrades confidence labels.
 */
export function generateEvidenceBoundedAiSummary(input: AiSummaryInput): AiSummaryOutput {
  const top = input.ranked[0];
  if (!top) {
    return {
      userSafeSummary: "No validated part match was found from available evidence.",
      whyTopRanked: ["No candidate met minimum ranking and confidence thresholds."],
      uncertaintyNotes: ["Search evidence is insufficient for match recommendation."],
      internalSummary: "No ranked candidates available for synthesis.",
    };
  }

  const second = input.ranked[1];
  const whyTopRanked: string[] = [];
  if ((top.scoreBreakdown?.vehicleFit ?? 0) >= 10) whyTopRanked.push("Vehicle fit signals were strongest for this candidate.");
  if ((top.scoreBreakdown?.oemConsistency ?? 0) >= 8) whyTopRanked.push("Evidence included consistent OEM-style references.");
  if ((top.scoreBreakdown?.querySimilarity ?? 0) >= 8) whyTopRanked.push("Part-intent keyword similarity was high.");
  if (second && top.confidenceScore - second.confidenceScore >= 8) whyTopRanked.push("Score separation from alternatives is meaningful.");
  if (whyTopRanked.length === 0) whyTopRanked.push("This candidate had the highest composite evidence score.");

  const observedRefs = top.oemCodes.map((x) => x.code).slice(0, 3);
  const userSafeSummary =
    top.confidenceLabel === "VERIFIED_MATCH"
      ? `${top.candidatePartName} is the strongest evidence-supported lead so far; confirm fitment before order.${observedRefs.length ? ` Observed refs: ${observedRefs.join(", ")}.` : ""}`
      : `${top.candidatePartName} is a lead candidate and requires fitment confirmation before final order.${observedRefs.length ? ` Observed refs: ${observedRefs.join(", ")}.` : ""}`;

  return {
    userSafeSummary,
    whyTopRanked,
    uncertaintyNotes: uncertaintyNotesFor(top),
    internalSummary: `${top.candidatePartName} selected by deterministic ranking. Confidence=${top.confidenceLabel}.`,
  };
}
