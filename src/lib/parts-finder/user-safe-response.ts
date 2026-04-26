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
  safe.result = buildNormalizedCustomerResult(safe);
  return safe;
}

type NormalizedCustomerResult = {
  partName: string;
  searchedVehicle: { year: number | null; make: string | null; model: string | null; engine: string | null };
  quickVerdict: string;
  functionSummary: string;
  maintenanceNote: string;
  symptoms: string;
  oemNumbers: {
    primary: string | null;
    alternatives: string[];
    aftermarket: string[];
    confidence: "high" | "medium" | "low";
  };
  mayAlsoFit: Array<{ make: string; model: string; years: string; confidence: "high" | "medium" | "low"; note: string }>;
  matches: Array<{
    title: string;
    brand: string;
    partNumber: string | null;
    confidence: number;
    tier: "high" | "medium" | "low";
    fitmentStatus: "likely" | "verify" | "low";
    explanation: string;
    imageUrl: string | null;
    compatibleVehicles: string[];
    verificationRequired: true;
    verificationLevel: "verified" | "likely" | "unverified";
    verificationSource: "vin_match" | "oem_match" | "cross_reference" | "pattern";
    verificationScore: number;
    isPremiumVerified: boolean;
  }>;
};

const OEM_STOP_WORDS = new Set(["TOYOTA", "COROLLA", "FACTORY", "FILTER", "ENGINE", "OIL", "GENUINE"]);
const AFTERMARKET_BRANDS = ["FRAM", "BOSCH", "DENSO", "WIX", "MANN", "K&N", "MAHLE", "MOBIL", "ACDELCO"];

function cleanCodes(values: string[]): string[] {
  return [...new Set(values.map((x) => x.trim().toUpperCase()))].filter((code) => {
    if (!code || OEM_STOP_WORDS.has(code)) return false;
    return /\d/.test(code) && /^[A-Z0-9-]{5,24}$/.test(code);
  });
}

function tierFrom(score: number, label: string): "high" | "medium" | "low" {
  if (label === "VERIFIED_MATCH" || score >= 85) return "high";
  if (label === "LIKELY_MATCH" || score >= 65) return "medium";
  return "low";
}

function verdictFor(params: { topTier: "high" | "medium" | "low"; oemCount: number; matchCount: number }): string {
  if (params.topTier === "high" && params.oemCount >= 2) {
    return "Most likely correct part, but engine variant must be confirmed.";
  }
  if (params.matchCount >= 2 && params.oemCount >= 1) {
    return "Multiple compatible options found. Verify using VIN/chassis before purchase.";
  }
  return "Low confidence match. Manual verification is required before purchase.";
}

function extractCompatibleVehicles(text: string): string[] {
  const rx = /\b(Toyota|Lexus|Honda|Nissan|Mazda|Kia|Hyundai|Ford|Chevrolet|Pontiac|Scion)\s+([A-Za-z0-9-]+)\b/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null = rx.exec(text);
  while (m) {
    out.push(`${m[1]} ${m[2]}`);
    m = rx.exec(text);
  }
  return [...new Set(out)].slice(0, 4);
}

function buildNormalizedCustomerResult(payload: Record<string, unknown>): NormalizedCustomerResult {
  const normalizedInput = (payload.normalizedInput ?? {}) as {
    year?: number | null;
    brand?: string | null;
    model?: string | null;
    engine?: string | null;
    partIntent?: string | null;
  };
  const ai = (payload.ai ?? {}) as {
    summary?: string;
    confidence?: "LOW" | "MEDIUM";
    fitmentNotes?: string[];
    possibleOemNumbers?: string[];
    possiblePartNames?: string[];
  };
  const rawResults = Array.isArray(payload.results)
    ? (payload.results as Array<{
        candidate?: {
          candidatePartName?: string;
          confidenceScore?: number;
          confidenceLabel?: string;
          summaryExplanation?: string;
          partFunctionSummary?: string;
          fitmentNotes?: string | null;
        verificationLevel?: "verified" | "likely" | "unverified";
          verificationSource?: "vin_match" | "oem_match" | "cross_reference" | "pattern";
        verificationScore?: number;
          isPremiumVerified?: boolean;
          oemCodes?: Array<{ code?: string }>;
          images?: Array<{ url?: string }>;
        };
      }>)
    : [];
  const topCandidate = rawResults[0]?.candidate;
  const codes = cleanCodes([
    ...(Array.isArray(topCandidate?.oemCodes) ? topCandidate.oemCodes.map((c) => c.code ?? "") : []),
    ...(Array.isArray(ai.possibleOemNumbers) ? ai.possibleOemNumbers : []),
  ]);
  const aftermarket = (ai.possiblePartNames ?? []).filter((name) =>
    AFTERMARKET_BRANDS.some((brand) => name.toUpperCase().includes(brand)),
  );
  const normalizedMatches = rawResults.map((row) => {
    const candidate = row.candidate ?? {};
    const score = Number(candidate.confidenceScore ?? 0);
    const label = candidate.confidenceLabel ?? "NEEDS_VERIFICATION";
    const tier = tierFrom(score, label);
    const fitmentStatus: "likely" | "verify" | "low" = tier === "high" ? "likely" : tier === "medium" ? "verify" : "low";
    const partNumber = cleanCodes(Array.isArray(candidate.oemCodes) ? candidate.oemCodes.map((x) => x.code ?? "") : [])[0] ?? null;
    return {
      title: candidate.candidatePartName ?? "Part candidate",
      brand: (candidate.candidatePartName ?? "").split(" ")[0] || "Catalog",
      partNumber,
      confidence: score,
      tier,
      fitmentStatus,
      explanation: "Matched based on OEM cross-reference and engine compatibility patterns.",
      imageUrl: Array.isArray(candidate.images) ? (candidate.images.map((x) => x.url ?? "").find(Boolean) ?? null) : null,
      compatibleVehicles: extractCompatibleVehicles(`${candidate.fitmentNotes ?? ""} ${candidate.summaryExplanation ?? ""}`),
      verificationRequired: true as const,
      verificationLevel:
        candidate.verificationLevel ?? (tier === "high" ? "verified" : tier === "medium" ? "likely" : "unverified"),
      verificationSource: candidate.verificationSource ?? (partNumber ? "oem_match" : "pattern"),
      verificationScore: Number(candidate.verificationScore ?? score),
      isPremiumVerified: Boolean(candidate.isPremiumVerified),
    };
  });
  const topTier = normalizedMatches[0]?.tier ?? "low";
  return {
    partName: topCandidate?.candidatePartName ?? normalizedInput.partIntent ?? "Part candidate",
    searchedVehicle: {
      year: normalizedInput.year ?? null,
      make: normalizedInput.brand ?? null,
      model: normalizedInput.model ?? null,
      engine: normalizedInput.engine ?? null,
    },
    quickVerdict: verdictFor({ topTier, oemCount: codes.length, matchCount: normalizedMatches.length }),
    functionSummary:
      topCandidate?.partFunctionSummary ??
      "This component supports normal vehicle operation and should be matched to VIN/chassis for correct fitment.",
    maintenanceNote:
      "Follow manufacturer maintenance intervals and replace early if leakage, contamination, or unusual performance appears.",
    symptoms:
      "Potential signs include reduced performance, warning lights, unusual noise, or lubrication/flow issues.",
    oemNumbers: {
      primary: codes[0] ?? null,
      alternatives: codes.slice(1, 6),
      aftermarket: aftermarket.slice(0, 6),
      confidence: topTier,
    },
    mayAlsoFit: extractCompatibleVehicles(
      `${(ai.fitmentNotes ?? []).join(" ")} ${topCandidate?.fitmentNotes ?? ""} ${topCandidate?.summaryExplanation ?? ""}`,
    ).map((vehicle) => {
      const [make = "Vehicle", ...rest] = vehicle.split(" ");
      return {
        make,
        model: rest.join(" ") || "Model",
        years: "Check catalog years",
        confidence: topTier,
        note: "Verify by VIN/chassis before purchase.",
      };
    }),
    matches: normalizedMatches,
  };
}
