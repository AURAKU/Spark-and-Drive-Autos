import type { VehicleQueryPayload } from "@/lib/parts-finder/identifier-crypto";
import { normalizePartsQuery, summarizePartsResults } from "@/lib/ai/parts-finder-ai";
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
import { decodeVin } from "@/lib/vin";

export async function orchestratePartsFinderSearch(
  payload: VehicleQueryPayload,
  userId: string,
  membership: MembershipAccessSnapshot,
  trace?: { jobId?: string },
) {
  let enrichedPayload: VehicleQueryPayload = { ...payload };
  if (payload.vin?.trim()) {
    try {
      const decoded = await decodeVin(payload.vin);
      enrichedPayload = {
        ...enrichedPayload,
        vin: decoded.vin,
        brand: decoded.make ?? enrichedPayload.brand,
        model: decoded.model ?? enrichedPayload.model,
        year: decoded.year ?? enrichedPayload.year,
        engine: decoded.engine ?? enrichedPayload.engine,
        trim: decoded.trim ?? enrichedPayload.trim,
      };
    } catch {
      // Keep manual vehicle input path as fallback if VIN provider fails.
    }
  }
  const cleanedDescription = await normalizePartsQuery(payload.partDescription ?? "", trace);
  const payloadWithAiCleanup: VehicleQueryPayload = {
    ...enrichedPayload,
    partDescription: cleanedDescription || enrichedPayload.partDescription,
  };
  const { normalized, cleanedPayload } = normalizePartsFinderInput(payloadWithAiCleanup);
  const vehicle = parseVehicleDescriptor(cleanedPayload);
  const queryForms = buildPartsFinderQueries(cleanedPayload, vehicle);
  const rawEvidence = await discoverExternalPartsEvidence(queryForms.external, normalized, trace);
  const parsedCandidates = parseExternalCandidates(rawEvidence);
  console.log("[parts:image] raw image candidates", parsedCandidates.filter((c) => Boolean(c.thumbnailUrl)).length);
  console.log(
    "[parts:image] first image candidate",
    parsedCandidates.find((c) => Boolean(c.thumbnailUrl))?.thumbnailUrl ?? null,
  );

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
  const ai = await summarizePartsResults(
    {
      query: payload.partDescription ?? "",
      normalizedQuery: cleanedDescription || (payload.partDescription ?? ""),
      serperResults: rawEvidence.map((row) => ({
        title: row.title,
        snippet: row.snippet,
        sourceUrl: row.sourceUrl ?? null,
        oemReferences: row.oemReferences,
        alternateReferences: row.alternateReferences,
        fitmentClues: row.fitmentClues,
      })),
      vehicleContext: {
        brand: vehicle.brand ?? (normalized as { brand?: string | null }).brand ?? null,
        model: vehicle.model ?? (normalized as { model?: string | null }).model ?? null,
        year: vehicle.year ?? (normalized as { year?: number | null }).year ?? null,
        engine: vehicle.engine ?? (normalized as { engine?: string | null }).engine ?? null,
      },
    },
    trace,
  );

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
    ai,
    normalizedQuery: cleanedDescription,
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
    ai,
  };
}
