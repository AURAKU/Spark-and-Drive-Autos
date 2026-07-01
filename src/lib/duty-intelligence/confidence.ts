import type { ConfidenceResult, SimilarImportMatch } from "./types";

export function computeConfidence(similarImports: SimilarImportMatch[]): ConfidenceResult {
  const count = similarImports.length;
  if (count === 0) {
    return {
      score: 62,
      label: "LOW",
      similarImportCount: 0,
      basisNote: "No verified similar imports in database — estimate based on configured formulas only.",
    };
  }

  const avgWeight = similarImports.reduce((s, m) => s + m.weight, 0) / count;
  const weightBonus = Math.min(35, avgWeight * 0.4);
  const countBonus = Math.min(30, count * 1.2);
  const score = Math.min(99.5, Math.round((55 + weightBonus + countBonus) * 10) / 10);

  let label: ConfidenceResult["label"] = "MEDIUM";
  if (score >= 90) label = "VERY_HIGH";
  else if (score >= 80) label = "HIGH";
  else if (score < 70) label = "LOW";

  return {
    score,
    label,
    similarImportCount: count,
    basisNote: `Based on ${count} verified import${count === 1 ? "" : "s"} with similar make, model, year, fuel type, and value range.`,
  };
}
