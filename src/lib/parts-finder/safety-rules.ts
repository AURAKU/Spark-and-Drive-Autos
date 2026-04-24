import type { SearchPipelineResultRow } from "@/lib/parts-finder/search-types";

export function applyPartsFinderSafetyRules(rows: SearchPipelineResultRow[]) {
  return rows
    .filter((row) => row.candidatePartName.trim().length > 2)
    .map((row) => {
      const suspiciousLanguage =
        /\bguaranteed fit|100% fit|exact oem guaranteed\b/i.test(`${row.candidatePartName} ${row.summaryExplanation}`) &&
        row.oemCodes.length === 0;
      const needsStrictDowngrade =
        suspiciousLanguage || row.oemCodes.length === 0 || row.confidenceScore < 74 || row.safetyFlagManualReview;
      const safeLabel = needsStrictDowngrade ? "NEEDS_VERIFICATION" : row.confidenceLabel;
      const safeScore = needsStrictDowngrade ? Math.min(row.confidenceScore, 73) : row.confidenceScore;
      const safeSummary = needsStrictDowngrade
        ? `${row.summaryExplanation} Verification required: do not treat this as guaranteed fit without OEM/supplier confirmation.`
        : row.summaryExplanation;
      return {
        ...row,
        confidenceLabel: safeLabel,
        confidenceScore: safeScore,
        summaryExplanation: safeSummary,
        safetyFlagManualReview:
          row.safetyFlagManualReview || suspiciousLanguage || safeLabel === "NEEDS_VERIFICATION" || row.oemCodes.length === 0,
      };
    })
    .slice(0, 8);
}
