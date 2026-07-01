import type { ConfidenceResult, DutyCalculationInput, SimilarImportMatch } from "./types";

export function computeConfidence(
  similarImports: SimilarImportMatch[],
  input?: DutyCalculationInput,
): ConfidenceResult {
  const reasons: string[] = ["Ghana duty database"];
  const count = similarImports.length;

  if (count === 0) {
    return {
      score: 62,
      label: "LOW",
      similarImportCount: 0,
      basisNote: "Insufficient historical data — estimate based on configured formulas and shipping matrix.",
      reasons: [
        "Ghana duty database",
        "Configured shipping cost matrix",
        "No similar verified imports yet",
      ],
    };
  }

  reasons.push("Historical imports");
  reasons.push("Real shipping cost matrix");

  if (input?.vehicle.engineCc) reasons.push("Similar engine size");
  if (input?.vehicle.countryOfOrigin) reasons.push("Same country of export");

  const avgWeight = similarImports.reduce((s, m) => s + m.weight, 0) / count;
  const weightBonus = Math.min(35, avgWeight * 0.4);
  const countBonus = Math.min(30, count * 1.2);
  const score = Math.min(99, Math.round((55 + weightBonus + countBonus) * 10) / 10);

  let label: ConfidenceResult["label"] = "MEDIUM";
  if (score >= 90) label = "VERY_HIGH";
  else if (score >= 80) label = "HIGH";
  else if (score < 70) label = "LOW";

  return {
    score,
    label,
    similarImportCount: count,
    basisNote: `Based on ${count} similar import${count === 1 ? "" : "s"} with matching make, model, year, fuel type, and value range.`,
    reasons,
  };
}

export function buildHistoricalComparison(params: {
  similarImports: SimilarImportMatch[];
  estimatedDutyGhs: number;
}): import("./types").HistoricalComparison | null {
  const withDuty = params.similarImports.filter((m) => m.totalDutyGhs != null && m.totalDutyGhs > 0);
  if (withDuty.length === 0) return null;

  const avgActualDutyGhs =
    Math.round((withDuty.reduce((s, m) => s + (m.totalDutyGhs ?? 0), 0) / withDuty.length) * 100) / 100;

  const differencePct =
    avgActualDutyGhs > 0
      ? Math.round((Math.abs(params.estimatedDutyGhs - avgActualDutyGhs) / avgActualDutyGhs) * 1000) / 10
      : null;

  return {
    similarImportCount: withDuty.length,
    avgActualDutyGhs,
    estimatedDutyGhs: params.estimatedDutyGhs,
    differencePct,
    note:
      differencePct != null && differencePct < 2
        ? `Estimate aligns within ${differencePct}% of ${withDuty.length} similar cleared imports.`
        : `Compared against ${withDuty.length} similar imports — avg actual duty ${avgActualDutyGhs.toLocaleString()} GHS.`,
  };
}
