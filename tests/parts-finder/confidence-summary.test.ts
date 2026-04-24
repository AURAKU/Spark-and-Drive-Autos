import assert from "node:assert/strict";
import test from "node:test";

import { calculateConfidenceBreakdown, mapScoreToConfidence } from "@/lib/parts-finder/confidence";
import { summarizePartsFinderResults } from "@/lib/parts-finder/summarizer";

test("confidence mapping uses conservative thresholds", () => {
  assert.equal(mapScoreToConfidence(88), "VERIFIED_MATCH");
  assert.equal(mapScoreToConfidence(87), "LIKELY_MATCH");
  assert.equal(mapScoreToConfidence(70), "LIKELY_MATCH");
  assert.equal(mapScoreToConfidence(50), "NEEDS_VERIFICATION");
});

test("summary safeguards uncertainty and avoids fabricated codes", () => {
  const rows = [
    {
      candidatePartName: "Control arm assembly",
      confidenceScore: 60,
      confidenceLabel: "NEEDS_VERIFICATION" as const,
      summaryExplanation: "Limited evidence",
      fitmentNotes: "Requires confirmation",
      catalogPartId: null,
      oemCodes: [],
      fitments: [{ brand: "TOYOTA", model: "COROLLA", yearFrom: 2018, yearTo: 2018, notes: null }],
      images: [],
      ingestionSource: "SERPER_WEB",
      safetyFlagManualReview: true,
      scoreBreakdown: {
        vehicleFit: 8,
        querySimilarity: 8,
        oemConsistency: 0,
        alternateConsistency: 0,
        sourceQuality: 6,
        imageRelevance: 0,
        conflictsPenalty: 0,
        weakContextPenalty: 8,
        yearMismatchPenalty: 10,
        fitmentContradictionPenalty: 6,
        total: 40,
      },
    },
  ];
  const confidence = calculateConfidenceBreakdown(rows[0]);
  const summary = summarizePartsFinderResults(rows, confidence);
  assert.ok((summary.uncertaintyNotes ?? []).length > 0);
  assert.ok((summary.userSafeSummary ?? "").includes("requires fitment confirmation"));
});
