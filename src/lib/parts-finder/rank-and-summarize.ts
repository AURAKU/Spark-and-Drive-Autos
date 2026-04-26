import { normalizePartsFinderImageUrl } from "@/lib/parts-finder/image-url";
import type { NormalizedPartsQuery } from "@/lib/parts-finder/normalize-query";
import type { ParsedSearchHit, PartMatchConfidenceLabel, SearchPipelineResultRow } from "@/lib/parts-finder/search-types";

const WEIGHTS = {
  BASE: 12,
  VEHICLE_FIT_MULTIPLIER: 2,
  QUERY_SIMILARITY_MULTIPLIER: 4,
  OEM_REF_WEIGHT: 4,
  ALT_REF_WEIGHT: 3,
  IMAGE_BONUS: 4,
  PREVIEW_PENALTY: 14,
  SERPER_BONUS: 4,
} as const;

/** Pull plausible reference tokens only from visible text — never invented. */
export function extractReferenceCodesFromEvidence(title: string, snippet: string): Array<{ code: string; label: string }> {
  const blob = `${title} ${snippet}`;
  const counts = new Map<string, number>();

  const patterns: RegExp[] = [
    /\b[A-Z]{1,4}[0-9]{3,}[A-Z0-9_-]{0,10}\b/g,
    /\b[0-9]{8,}[A-Z]{0,3}\b/g,
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, "g");
    while ((m = r.exec(blob)) !== null) {
      const code = m[0].replace(/[-_]+$/, "").toUpperCase();
      if (code.length < 6 || code.length > 24) continue;
      const canonical = code.replace(/[-_\s]/g, "");
      counts.set(canonical, (counts.get(canonical) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([code, seenCount]) => ({
      code,
      label:
        seenCount > 1
          ? "Observed repeatedly in evidence text (higher confidence, still verify)."
          : "Observed once in evidence text (verify with supplier/OEM).",
    }));
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((w) => w.length > 2 && w.length < 32),
  );
}

function overlapScore(n: NormalizedPartsQuery, text: string): number {
  const hay = tokenize(text);
  let score = 0;
  const brand = n.brand?.toLowerCase();
  const model = n.model?.toLowerCase();
  const intent = n.partIntent.toLowerCase();
  if (brand && hay.has(brand)) score += 3;
  if (model && hay.has(model)) score += 3;
  if (intent) {
    for (const w of intent.split(/\s+/)) {
      if (w.length > 3 && hay.has(w)) score += 2;
    }
  }
  if (n.year && text.includes(String(n.year))) score += 2;
  return score;
}

const MAX_RESULTS = 5;
const SOURCE_QUALITY: Record<string, number> = {
  toyota: 16,
  honda: 16,
  nissan: 16,
  hyundai: 16,
  kia: 16,
  bosch: 14,
  denso: 14,
  ngk: 14,
  preview: 3,
  web: 8,
};

function sourceQualityScore(sourceHint: string): number {
  const host = sourceHint.toLowerCase();
  for (const [key, score] of Object.entries(SOURCE_QUALITY)) {
    if (host.includes(key)) return score;
  }
  return 7;
}

function countMatches(haystack: string, terms: string[]): number {
  const lower = haystack.toLowerCase();
  return terms.filter((term) => term.length > 2 && lower.includes(term.toLowerCase())).length;
}

function buildPartFunctionSummary(partIntentCanonical: string | null, fallbackName: string): string {
  const key = (partIntentCanonical ?? "").toLowerCase();
  const known: Record<string, string> = {
    control_arm:
      "Helps keep wheel alignment stable and connects suspension components so steering remains controlled during acceleration, braking, and cornering.",
    brake_pad:
      "Creates friction against the brake rotor to slow the vehicle safely and consistently under pedal input.",
    wheel_bearing:
      "Allows the wheel hub to rotate smoothly while carrying vehicle load and maintaining stable wheel movement.",
    radiator:
      "Dissipates engine heat through coolant flow to prevent overheating and protect engine components.",
    thermostat:
      "Regulates coolant circulation based on engine temperature to keep operating temperature within safe range.",
    ignition_coil:
      "Converts battery voltage into high-voltage spark energy required to ignite the air-fuel mixture.",
    spark_plug:
      "Creates the spark that ignites the air-fuel mixture inside each engine cylinder.",
    fuel_injector:
      "Meters and sprays fuel into the engine in a controlled pattern for efficient combustion.",
    timing_chain:
      "Synchronizes crankshaft and camshaft timing so engine valves open and close at the correct moment.",
    water_pump:
      "Circulates coolant through the engine and radiator to maintain safe temperature control.",
  };
  return (
    known[key] ??
    `${fallbackName} supports critical vehicle performance and should be matched carefully to VIN/chassis fitment before purchase confirmation.`
  );
}

function collectRelevantImages(
  base: ParsedSearchHit,
  allCandidates: ParsedSearchHit[],
  desiredCount = 3,
): Array<{ url: string; kind: string }> {
  const urls: string[] = [];
  const seen = new Set<string>();
  const pushUrl = (url: string | null | undefined) => {
    const normalized = normalizePartsFinderImageUrl(url);
    if (!normalized) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    urls.push(normalized);
  };

  pushUrl(base.thumbnailUrl);
  if (urls.length < desiredCount) {
    const baseTokens = tokenize(`${base.title} ${base.snippet}`);
    for (const candidate of allCandidates) {
      if (!candidate.thumbnailUrl) continue;
      const overlap = [...tokenize(`${candidate.title} ${candidate.snippet}`)].filter((token) =>
        baseTokens.has(token),
      ).length;
      if (overlap >= 2 || candidate.sourceHint === base.sourceHint) {
        pushUrl(candidate.thumbnailUrl);
      }
      if (urls.length >= desiredCount) break;
    }
  }
  return urls.slice(0, desiredCount).map((url) => ({
    url,
    kind: "REFERENCE",
  }));
}

/**
 * Ranks external candidates and produces user-facing rows (no raw URLs).
 */
export function rankAndSummarizeExternal(
  n: NormalizedPartsQuery,
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
  const scored = candidates.map((c, idx) => {
    const text = `${c.title} ${c.snippet}`;
    const vehicleFit = Math.min(24, overlapScore(n, text) * WEIGHTS.VEHICLE_FIT_MULTIPLIER);
    const querySimilarity = Math.min(20, countMatches(text, n.expandedIntentTerms) * WEIGHTS.QUERY_SIMILARITY_MULTIPLIER);
    const oemConsistency = Math.min(18, (c.oemReferences?.length ?? 0) * WEIGHTS.OEM_REF_WEIGHT);
    const alternateConsistency = Math.min(10, (c.alternateReferences?.length ?? 0) * WEIGHTS.ALT_REF_WEIGHT);
    const sourceQuality = sourceQualityScore(c.sourceHint);
    const imageRelevance = c.thumbnailUrl || (c.imageHints?.length ?? 0) > 0 ? WEIGHTS.IMAGE_BONUS : 0;
    const hasVinMatch = Boolean(n.vinTail);
    const hasExactOemMatch = (c.oemReferences?.length ?? 0) > 0;
    const hasEngineMatch = Boolean(n.engine && text.toLowerCase().includes(n.engine.toLowerCase()));
    const hasRepeatedPartNumber = (c.oemReferences?.length ?? 0) >= 2;
    const missingEngine = !n.engine;

    const fitmentContradictionPenalty =
      n.qualifiers.length > 0 && countMatches(text, n.qualifiers.map((q) => q.toLowerCase())) === 0 ? 6 : 0;
    const yearMismatchPenalty =
      n.year != null && !text.includes(String(n.year)) && (c.fitmentClues?.some((x) => /^\d{4}$/.test(x)) ?? false) ? 10 : 0;
    const weakContextPenalty = n.partIntentTokens.length < 2 ? 8 : 0;
    const conflictsPenalty = c.oemReferences && c.oemReferences.length > 2 && countMatches(c.oemReferences.join(" "), n.partIntentTokens) === 0 ? 6 : 0;

    const conflictingData = fitmentContradictionPenalty > 0 || yearMismatchPenalty > 0 || conflictsPenalty > 0;
    let verificationScore = 0;
    if (hasVinMatch) verificationScore += 40;
    if (hasExactOemMatch) verificationScore += 30;
    if (hasEngineMatch) verificationScore += 20;
    if (hasRepeatedPartNumber) verificationScore += 10;
    if (missingEngine) verificationScore -= 20;
    if (conflictingData) verificationScore -= 20;
    verificationScore = Math.max(0, Math.min(100, verificationScore));

    const engineMatch = hasEngineMatch ? 10 : 0;
    const trimMatch = n.trim && text.toLowerCase().includes(n.trim.toLowerCase()) ? 6 : 0;
    const vinContextBoost = hasVinMatch ? 8 : 0;
    const repeatedReferenceBoost = hasRepeatedPartNumber ? 6 : 0;
    const missingEnginePenalty = missingEngine ? 6 : 0;

    const candidateSignature = c.evidenceSignature ?? "";
    const exactLearningBoost = learning?.signatureBoostMap.get(candidateSignature) ?? 0;
    const similarLearningBoost = learning?.similarSignatureBoostMap?.get(candidateSignature) ?? 0;
    const learningBoostRaw = exactLearningBoost + similarLearningBoost;
    const hasContradiction = fitmentContradictionPenalty > 0 || yearMismatchPenalty > 0 || conflictsPenalty > 0;
    const learningBoost = hasContradiction && learningBoostRaw > 0 ? 0 : Math.max(-8, Math.min(8, learningBoostRaw));

    let score =
      WEIGHTS.BASE +
      vehicleFit +
      querySimilarity +
      oemConsistency +
      alternateConsistency +
      sourceQuality +
      imageRelevance +
      engineMatch +
      trimMatch +
      vinContextBoost +
      repeatedReferenceBoost -
      fitmentContradictionPenalty -
      yearMismatchPenalty -
      weakContextPenalty -
      conflictsPenalty -
      missingEnginePenalty;
    score += learningBoost;
    if (c.ingestionSource === "FALLBACK_PREVIEW") score -= WEIGHTS.PREVIEW_PENALTY;
    if (c.ingestionSource === "SERPER_WEB") score += WEIGHTS.SERPER_BONUS;

    let label: PartMatchConfidenceLabel = "LIKELY_MATCH";
    let safety = false;

    if (!n.brand || !n.model || !n.partIntentCanonical) {
      label = "NEEDS_VERIFICATION";
      safety = true;
      score -= 10;
    } else if (verificationScore >= 90) {
      label = "VERIFIED_MATCH";
    } else if (verificationScore < 70 || c.ingestionSource === "FALLBACK_PREVIEW") {
      label = "NEEDS_VERIFICATION";
      safety = true;
    }

    const refs = extractReferenceCodesFromEvidence(c.title, c.snippet);
    const whyTopRanked: string[] = [];
    if (vehicleFit >= 12) whyTopRanked.push("Vehicle fit clues align with provided brand/model/year.");
    if (querySimilarity >= 10) whyTopRanked.push("Part intent and qualifier terms matched strongly.");
    if (oemConsistency >= 8) whyTopRanked.push("OEM-style references consistently observed across evidence.");
    if (sourceQuality >= 12) whyTopRanked.push("Evidence came from higher-trust source identities.");
    if (whyTopRanked.length === 0) whyTopRanked.push("Ranking driven by partial text and fitment hints.");

    const summaryExplanation =
      label === "VERIFIED_MATCH"
        ? `Strong alignment between your vehicle/part intent and evidence signals. References shown are extracted from evidence text and still require supplier/OEM verification.`
        : label === "LIKELY_MATCH"
          ? `Moderate alignment with market evidence. Treat as a lead candidate and verify fitment against VIN/chassis before order confirmation.`
          : `Evidence is weak, conflicting, or preview-only. Manual verification is required before quoting as an exact match.`;

    const images = collectRelevantImages(c, candidates, 3);
    const partFunctionSummary = buildPartFunctionSummary(n.partIntentCanonical, c.title.slice(0, 160));

    const verificationLevel: "verified" | "likely" | "unverified" =
      verificationScore >= 90 ? "verified" : verificationScore >= 70 ? "likely" : "unverified";
    const verificationSource: "vin_match" | "oem_match" | "cross_reference" | "pattern" = hasVinMatch
      ? "vin_match"
      : hasExactOemMatch
        ? "oem_match"
        : hasRepeatedPartNumber
          ? "cross_reference"
          : "pattern";
    const isPremiumVerified = verificationLevel === "verified" && hasVinMatch;
    const verificationWhy: string[] = [];
    if (hasVinMatch) verificationWhy.push("VIN match signal detected");
    if (hasExactOemMatch) verificationWhy.push("Exact OEM reference detected");
    if (hasEngineMatch) verificationWhy.push("Engine alignment detected");
    if (hasRepeatedPartNumber) verificationWhy.push("Repeated part number across sources");
    if (missingEngine) verificationWhy.push("Missing engine specification");
    if (conflictingData) verificationWhy.push("Conflicting fitment signals detected");

    return {
      candidatePartName: c.title.slice(0, 200),
      confidenceScore: Math.min(99, Math.max(35, Math.round(score + idx * 0.5))),
      confidenceLabel: label,
      verificationLevel,
      verificationSource,
      verificationScore,
      isPremiumVerified,
      summaryExplanation,
      partFunctionSummary,
      fitmentNotes:
        n.vehicleLine || n.vinTail || n.chassisTail
          ? `Context: ${[n.brand, n.model, n.year, n.engine, n.trim].filter(Boolean).join(" · ")}${n.vinTail ? ` · VIN tail …${n.vinTail}` : ""}${n.chassisTail ? ` · chassis …${n.chassisTail}` : ""}`
          : "Complete vehicle identification improves match quality.",
      catalogPartId: null,
      oemCodes: refs,
      fitments: [
        {
          brand: n.brand,
          model: n.model,
          yearFrom: n.year,
          yearTo: n.year,
          notes: null,
        },
      ],
      images,
      ingestionSource: c.ingestionSource,
      safetyFlagManualReview: safety,
      scoreBreakdown: {
        vehicleFit,
        querySimilarity,
        oemConsistency,
        alternateConsistency,
        sourceQuality,
        imageRelevance,
        // Engine/trim/vin boosts are included in total score only.
        conflictsPenalty,
        weakContextPenalty,
        yearMismatchPenalty,
        fitmentContradictionPenalty,
        total: score,
      },
      metadataJson: {
        pipeline: "external-v2",
        userId,
        sourceIdentity: c.sourceIdentity ?? c.sourceHint,
        rankScore: score,
        whyTopRanked,
        evidenceSignature: c.evidenceSignature ?? null,
        fitmentClues: c.fitmentClues ?? [],
        alternateReferences: c.alternateReferences ?? [],
        verification: {
          score: verificationScore,
          level: verificationLevel,
          source: verificationSource,
          isPremiumVerified,
          why: verificationWhy,
          signals: {
            vinMatch: hasVinMatch,
            oemMatch: hasExactOemMatch,
            engineMatch: hasEngineMatch,
            repeatedPartNumber: hasRepeatedPartNumber,
            missingEngine,
            conflictingData,
          },
        },
        learningBoost,
        learningContext: learning
          ? {
              exactPositive: learning.exactPositive,
              exactLikely: learning.exactLikely,
              exactRejected: learning.exactRejected,
              similarPositive: learning.similarPositive ?? 0,
              similarLikely: learning.similarLikely ?? 0,
              similarRejected: learning.similarRejected ?? 0,
            }
          : null,
      },
    };
  });

  const levelWeight = (row: SearchPipelineResultRow) =>
    row.verificationLevel === "verified" ? 3 : row.verificationLevel === "likely" ? 2 : 1;
  const completeness = (row: SearchPipelineResultRow) =>
    (row.oemCodes?.length ?? 0) + (row.images?.length ?? 0) + (row.fitments?.length ?? 0);
  scored.sort((a, b) => {
    const byLevel = levelWeight(b) - levelWeight(a);
    if (byLevel !== 0) return byLevel;
    const byConfidence = b.confidenceScore - a.confidenceScore;
    if (byConfidence !== 0) return byConfidence;
    return completeness(b) - completeness(a);
  });
  return scored.slice(0, MAX_RESULTS);
}
