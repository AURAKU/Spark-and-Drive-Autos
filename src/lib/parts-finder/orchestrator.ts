import type { VehicleQueryPayload } from "@/lib/parts-finder/identifier-crypto";
import { calculateConfidenceBreakdown } from "@/lib/parts-finder/confidence";
import { normalizeFitmentDisplay } from "@/lib/parts-finder/conversion";
import { discoverExternalPartsEvidence } from "@/lib/parts-finder/external-search";
import { normalizePartsFinderInput } from "@/lib/parts-finder/input-normalizer";
import { getOutcomeLearningSignals, logPartsFinderSearchEvent } from "@/lib/parts-finder/persistence";
import { buildPartsFinderQueries } from "@/lib/parts-finder/query-builder";
import { rankPartsFinderCandidates } from "@/lib/parts-finder/ranking";
import { parseExternalCandidates } from "@/lib/parts-finder/result-parser";
import { applyPartsFinderSafetyRules } from "@/lib/parts-finder/safety-rules";
import { summarizePartsFinderResults } from "@/lib/parts-finder/summarizer";
import { parseVehicleDescriptor } from "@/lib/parts-finder/vehicle-parser";
import type { MembershipAccessSnapshot } from "@/lib/parts-finder/search-types";

export async function orchestratePartsFinderSearch(
  payload: VehicleQueryPayload,
  userId: string,
  membership: MembershipAccessSnapshot,
) {
  const { normalized, cleanedPayload } = normalizePartsFinderInput(payload);
  const vehicle = parseVehicleDescriptor(cleanedPayload);
  const queryForms = buildPartsFinderQueries(cleanedPayload, vehicle);
  const rawEvidence = await discoverExternalPartsEvidence(queryForms.external, normalized);
  const parsedCandidates = parseExternalCandidates(rawEvidence);

  const learning = await getOutcomeLearningSignals({
    normalizedInput: normalized as unknown as Record<string, unknown>,
    candidateSignatures: parsedCandidates.map((x) => x.evidenceSignature ?? "").filter(Boolean),
  });

  const rankedCandidates = rankPartsFinderCandidates(normalized, parsedCandidates, userId, learning);
  const fitmentNormalized = normalizeFitmentDisplay(vehicle, rankedCandidates);
  const filteredCandidates = applyPartsFinderSafetyRules(fitmentNormalized);
  const refinedCandidates = filteredCandidates.slice(0, 3);
  const confidence = refinedCandidates.length > 0 ? calculateConfidenceBreakdown(refinedCandidates[0]) : null;
  const summary = summarizePartsFinderResults(refinedCandidates, confidence);

  const sessionId = await logPartsFinderSearchEvent({
    userId,
    rawInput: payload as Record<string, unknown>,
    normalizedInput: normalized as unknown as Record<string, unknown>,
    vehicle,
    queryForms,
    rawEvidence,
    parsedCandidates,
    rawHits: parsedCandidates,
    refinedResults: refinedCandidates,
    rankedResults: filteredCandidates,
    confidence,
    summary,
    membership,
  });

  return {
    sessionId,
    normalizedInput: normalized,
    vehicle,
    queryForms,
    rawHits: parsedCandidates,
    rankedResults: refinedCandidates,
    confidence,
    summary,
  };
}
