import { nanoid } from "nanoid";
import type { PartsFinderConfidenceLabel, PartsFinderSearchStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { buildUserSafeSessionPayload } from "@/lib/parts-finder/user-safe-response";
import type { ExternalCandidate } from "@/lib/parts-finder/external/types";
import type {
  ConfidenceBreakdown,
  MembershipAccessSnapshot,
  ParsedSearchHit,
  ParsedVehicleData,
  QueryForms,
  ReviewStatus,
  SearchPipelineResultRow,
  StructuredSummary,
} from "@/lib/parts-finder/search-types";

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v != null ? (v as Record<string, unknown>) : {};
}

function toVehicleSignature(normalizedInput: Record<string, unknown>): string {
  const brand = String(normalizedInput.brand ?? "").toLowerCase().trim();
  const model = String(normalizedInput.model ?? "").toLowerCase().trim();
  const year = String(normalizedInput.year ?? "").trim();
  const engine = String(normalizedInput.engine ?? "").toLowerCase().trim();
  return [brand, model, year, engine].filter(Boolean).join("|") || "unknown";
}

function toIntentSignature(normalizedInput: Record<string, unknown>): string {
  const canonical = String(normalizedInput.partIntentCanonical ?? "").toLowerCase().trim();
  const raw = String(normalizedInput.partIntent ?? "").toLowerCase().trim();
  return canonical || raw || "unknown";
}

function buildSessionAnalyticsLabels(
  normalizedInput: Record<string, unknown>,
  vehicle: ParsedVehicleData,
  rankedResultCount: number,
): {
  analyticsVehicleLabel: string | null;
  analyticsMakeModelLabel: string | null;
  analyticsPartIntentLabel: string | null;
  hasRankedResults: boolean;
} {
  const brand = String(normalizedInput.brand ?? vehicle.brand ?? "").trim();
  const model = String(normalizedInput.model ?? vehicle.model ?? "").trim();
  const yearRaw = normalizedInput.year ?? vehicle.year;
  const year = yearRaw != null && String(yearRaw).trim() !== "" ? String(yearRaw).trim() : "";
  const partIntent = String(
    normalizedInput.partIntentCanonical ?? normalizedInput.partIntent ?? "",
  ).trim();
  const vehicleLabel = [brand, model, year].filter(Boolean).join(" · ") || null;
  const makeModelLabel = [brand, model].filter(Boolean).join(" · ") || null;
  return {
    analyticsVehicleLabel: vehicleLabel,
    analyticsMakeModelLabel: makeModelLabel,
    analyticsPartIntentLabel: partIntent.length > 0 ? partIntent : null,
    hasRankedResults: rankedResultCount > 0,
  };
}

function shouldAutoApprove(params: {
  approvalMode: "AUTO" | "MANUAL";
  requireManualReviewBelow: number;
  topConfidence: number | null;
  topLabel: PartsFinderConfidenceLabel | null;
}): boolean {
  if (params.approvalMode !== "AUTO") return false;
  if (params.topConfidence == null) return false;
  if (params.topLabel === "NEEDS_VERIFICATION" || params.topLabel == null) return false;
  return params.topConfidence >= params.requireManualReviewBelow;
}

export async function logPartsFinderSearchEvent(params: {
  userId: string;
  rawInput: Record<string, unknown>;
  normalizedInput: Record<string, unknown>;
  vehicle: ParsedVehicleData;
  queryForms: QueryForms;
  rawEvidence: ExternalCandidate[];
  parsedCandidates: ParsedSearchHit[];
  rawHits: ParsedSearchHit[];
  refinedResults: SearchPipelineResultRow[];
  rankedResults: SearchPipelineResultRow[];
  confidence: ConfidenceBreakdown | null;
  summary: StructuredSummary;
  ai?: Record<string, unknown>;
  normalizedQuery?: string;
  membership: MembershipAccessSnapshot;
}) {
  const sessionId = `PF-${nanoid(12).toUpperCase()}`;
  const topConfidence = params.rankedResults[0]?.confidenceScore ?? null;
  const confidenceLabel: PartsFinderConfidenceLabel | null =
    params.rankedResults[0]?.confidenceLabel === "VERIFIED_MATCH" ||
    params.rankedResults[0]?.confidenceLabel === "LIKELY_MATCH" ||
    params.rankedResults[0]?.confidenceLabel === "NEEDS_VERIFICATION"
      ? params.rankedResults[0].confidenceLabel
      : null;

  const membership = await prisma.partsFinderMembership.findFirst({
    where: { userId: params.userId, status: "ACTIVE", endsAt: { gt: new Date() } },
    orderBy: { endsAt: "desc" },
    select: { id: true },
  });
  const settings = await prisma.partsFinderSettings.findFirst({
    orderBy: { updatedAt: "desc" },
    select: {
      approvalMode: true,
      requireManualReviewBelow: true,
    },
  });
  const approvalMode = settings?.approvalMode ?? "MANUAL";
  const threshold = settings?.requireManualReviewBelow ?? 55;
  const initialStatus: PartsFinderSearchStatus = shouldAutoApprove({
    approvalMode,
    requireManualReviewBelow: threshold,
    topConfidence,
    topLabel: confidenceLabel,
  })
    ? "APPROVED"
    : "PENDING_REVIEW";

  const analyticsLabels = buildSessionAnalyticsLabels(
    params.normalizedInput,
    params.vehicle,
    params.rankedResults.length,
  );

  const created = await prisma.partsFinderSearchSession.create({
    data: {
      sessionId,
      userId: params.userId,
      membershipId: membership?.id ?? null,
      analyticsVehicleLabel: analyticsLabels.analyticsVehicleLabel,
      analyticsMakeModelLabel: analyticsLabels.analyticsMakeModelLabel,
      analyticsPartIntentLabel: analyticsLabels.analyticsPartIntentLabel,
      hasRankedResults: analyticsLabels.hasRankedResults,
      inputJson: params.rawInput as Prisma.InputJsonValue,
      normalizedJson: params.normalizedInput as Prisma.InputJsonValue,
      vehicleJson: params.vehicle as Prisma.InputJsonValue,
      queryFormsJson: params.queryForms as Prisma.InputJsonValue,
      rawEvidenceJson: params.rawEvidence as Prisma.InputJsonValue,
      parsedResultsJson: params.parsedCandidates as Prisma.InputJsonValue,
      rawResultsJson: params.rawHits as Prisma.InputJsonValue,
      refinedResultsJson: params.refinedResults as Prisma.InputJsonValue,
      rankedResultsJson: params.rankedResults as Prisma.InputJsonValue,
      confidenceJson: (params.confidence as Prisma.InputJsonValue | null) ?? undefined,
      summaryJson: params.summary as Prisma.InputJsonValue,
      safetyFlagsJson: ({
        membershipSnapshot: params.membership,
        approvalMode,
        requireManualReviewBelow: threshold,
        ai: params.ai ?? null,
        normalizedQuery: params.normalizedQuery ?? String((params.normalizedInput.partIntent as string | undefined) ?? ""),
      } as Prisma.InputJsonValue),
      status: initialStatus,
      confidenceLabel,
      confidenceScore: topConfidence,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: params.userId,
      action: "parts_finder.search.created",
      entityType: "PartsFinderSession",
      entityId: created.sessionId,
      metadataJson: ({
        review: {
          status: (initialStatus === "APPROVED" ? "APPROVED" : "PENDING") as ReviewStatus,
          reviewerId: null,
          reviewedAt: null,
          adminNote: null,
          forcedSummary: null,
        },
        rawInput: params.rawInput,
        normalizedInput: params.normalizedInput,
        parsedVehicle: params.vehicle,
        queryForms: params.queryForms,
        rawEvidence: params.rawEvidence,
        parsedCandidates: params.parsedCandidates,
        rawHits: params.rawHits,
        refinedResults: params.refinedResults,
        rankedResults: params.rankedResults,
        confidence: params.confidence,
        summary: params.summary,
        ai: params.ai ?? null,
        metrics: {
          resultCount: params.rankedResults.length,
          averageConfidence:
            params.rankedResults.length > 0
              ? Math.round(
                  params.rankedResults.reduce((sum, row) => sum + row.confidenceScore, 0) / params.rankedResults.length,
                )
              : 0,
        },
        membershipSnapshot: params.membership,
      } as Prisma.InputJsonValue),
    },
  });
  const rawInput = params.rawInput as Record<string, unknown>;
  const partImage = (rawInput.partImage ?? null) as Record<string, unknown> | null;
  const refinedTopRows = params.refinedResults.slice(0, 3);
  await prisma.$transaction(async (tx) => {
    if (partImage) {
      await tx.partsFinderSearchImage.create({
        data: {
          sessionId: created.id,
          kind: "PART_IMAGE",
          fileName: typeof partImage.fileName === "string" ? partImage.fileName : null,
          mimeType: typeof partImage.mimeType === "string" ? partImage.mimeType : null,
          sizeBytes: typeof partImage.sizeBytes === "number" ? Math.trunc(partImage.sizeBytes) : null,
        },
      });
    }

    for (const [idx, row] of refinedTopRows.entries()) {
      const createdResult = await tx.partsFinderResult.create({
        data: {
          sessionId: created.id,
          userId: params.userId,
          candidateJson: row as Prisma.InputJsonValue,
          summaryJson: {
            summaryExplanation: row.summaryExplanation,
            fitmentNotes: row.fitmentNotes,
          } as Prisma.InputJsonValue,
          derivationJson: {
            scoreBreakdown: row.scoreBreakdown ?? null,
            metadata: row.metadataJson ?? {},
          } as Prisma.InputJsonValue,
          confidenceLabel:
            row.confidenceLabel === "VERIFIED_MATCH" || row.confidenceLabel === "LIKELY_MATCH" || row.confidenceLabel === "NEEDS_VERIFICATION"
              ? row.confidenceLabel
              : null,
          confidenceScore: row.confidenceScore,
          isTopResult: idx === 0,
          reviewStatus: initialStatus,
        },
      });

      if (row.oemCodes.length > 0) {
        await tx.partsFinderResultReference.createMany({
          data: row.oemCodes.map((code) => ({
            resultId: createdResult.id,
            referenceType: "OEM",
            referenceCode: code.code,
            label: code.label ?? null,
          })),
        });
      }
      if (row.fitments.length > 0) {
        await tx.partsFinderResultFitment.createMany({
          data: row.fitments.map((fitment) => ({
            resultId: createdResult.id,
            brand: fitment.brand,
            model: fitment.model,
            yearFrom: fitment.yearFrom,
            yearTo: fitment.yearTo,
            notes: fitment.notes,
          })),
        });
      }
      if (idx === 0) {
        await tx.partsFinderSupportVerification.create({
          data: {
            resultId: createdResult.id,
            status: "PENDING",
            note: "Awaiting support/admin verification for premium guidance.",
          },
        });
      }
    }
  });
  return created.sessionId;
}

export async function getPartsFinderSessionForUser(sessionId: string, userId: string) {
  const row = await prisma.partsFinderSearchSession.findFirst({
    where: { sessionId, userId },
    include: {
      results: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          candidateJson: true,
          summaryJson: true,
          confidenceLabel: true,
          confidenceScore: true,
          isTopResult: true,
          reviewStatus: true,
          sourcingLinked: true,
          createdAt: true,
        },
      },
    },
  });
  if (!row) return null;
  const baseMeta = {
    input: row.inputJson,
    normalizedInput: row.normalizedJson,
    parsedVehicle: row.vehicleJson,
    queryForms: row.queryFormsJson,
    rawHits: row.rawResultsJson,
    rawEvidence: row.rawEvidenceJson,
    parsedCandidates: row.parsedResultsJson,
    refinedResults: row.refinedResultsJson,
    rankedResults: row.rankedResultsJson,
    results: row.results.map((r) => ({
      id: r.id,
      candidate: r.candidateJson,
      summary: r.summaryJson,
      confidenceLabel: r.confidenceLabel,
      confidenceScore: r.confidenceScore,
      isTopResult: r.isTopResult,
      reviewStatus: r.reviewStatus,
      sourcingLinked: r.sourcingLinked,
      createdAt: r.createdAt.toISOString(),
    })),
    confidence: row.confidenceJson,
    summary: row.summaryJson,
    ai: (row.safetyFlagsJson as Record<string, unknown> | null)?.ai ?? null,
    normalizedQuery: (row.safetyFlagsJson as Record<string, unknown> | null)?.normalizedQuery ?? null,
    review: {
      status: row.status,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      reviewerId: row.reviewedById ?? null,
      adminNote: row.reviewNote ?? null,
      forcedSummary: row.adminSummaryOverride ?? null,
    },
  };
  return {
    id: row.id,
    action: "parts_finder.search.created",
    entityId: row.sessionId,
    createdAt: row.createdAt,
    metadataJson: buildUserSafeSessionPayload(baseMeta) as Record<string, unknown>,
  };
}

export async function listPartsFinderSessionsForUser(userId: string, limit = 30) {
  const rows = await prisma.partsFinderSearchSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(1, limit), 100),
  });
  return rows.map((row) => ({
    id: row.id,
    entityId: row.sessionId,
    action: "parts_finder.search.created",
    createdAt: row.createdAt,
    metadataJson: {
      normalizedInput: row.normalizedJson,
      summary: row.summaryJson,
      confidence: row.confidenceJson,
      review: { status: row.status },
    },
  }));
}

export async function getPartsFinderResultDetailForUser(params: {
  userId: string;
  sessionId: string;
  resultId: string;
}) {
  const session = await prisma.partsFinderSearchSession.findFirst({
    where: { sessionId: params.sessionId, userId: params.userId },
    select: { id: true, sessionId: true, status: true, reviewedAt: true, reviewNote: true },
  });
  if (!session) return null;

  const result = await prisma.partsFinderResult.findFirst({
    where: { id: params.resultId, sessionId: session.id },
    select: {
      id: true,
      candidateJson: true,
      summaryJson: true,
      derivationJson: true,
      confidenceLabel: true,
      confidenceScore: true,
      isTopResult: true,
      reviewStatus: true,
      sourcingLinked: true,
      references: {
        select: {
          referenceType: true,
          referenceCode: true,
          label: true,
        },
      },
      fitmentsDetailed: {
        select: {
          brand: true,
          model: true,
          yearFrom: true,
          yearTo: true,
          notes: true,
        },
      },
      verifications: {
        orderBy: { createdAt: "desc" },
        select: {
          status: true,
          note: true,
          verifiedPartName: true,
          verifiedOemCode: true,
          createdAt: true,
        },
      },
      createdAt: true,
    },
  });
  if (!result) return null;

  return {
    session,
    result,
  };
}

export async function listQueuedPartsFinderReviews(limit = 100) {
  const rows = await prisma.partsFinderSearchSession.findMany({
    where: { status: "PENDING_REVIEW" },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 300),
    include: {
      user: { select: { email: true, name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    action: "parts_finder.search.created",
    entityType: "PartsFinderSession",
    entityId: row.sessionId,
    createdAt: row.createdAt,
    actor: row.user,
    metadataJson: {
      review: { status: row.status },
      normalizedInput: row.normalizedJson,
      confidence: row.confidenceJson,
      summary: row.summaryJson,
      rankedResults: row.rankedResultsJson,
    },
  }));
}

export async function applyPartsFinderReviewOverride(params: {
  sessionId: string;
  reviewerId: string;
  decision: ReviewStatus;
  adminNote?: string;
  forcedSummary?: string;
  resultId?: string;
  correctedPartName?: string;
  correctedOemCodes?: string[];
}) {
  const base = await prisma.partsFinderSearchSession.findFirst({
    where: { sessionId: params.sessionId },
    include: {
      results: {
        orderBy: [{ isTopResult: "desc" }, { createdAt: "asc" }],
        select: { id: true, candidateJson: true, isTopResult: true },
      },
    },
  });
  if (!base) throw new Error("Session not found.");
  const summary = ((base.summaryJson as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
  const nextSummary =
    params.forcedSummary && params.forcedSummary.trim().length > 0
      ? { ...summary, headline: params.forcedSummary.trim(), forcedByAdmin: true }
      : summary;

  const nextStatus: PartsFinderSearchStatus =
    params.decision === "LOW_CONFIDENCE"
      ? "LOW_CONFIDENCE"
      : params.decision === "APPROVED"
        ? "APPROVED"
        : params.decision === "VERIFIED"
          ? "VERIFIED"
          : params.decision === "LIKELY"
            ? "LIKELY"
            : params.decision === "FLAGGED_SOURCING"
              ? "FLAGGED_SOURCING"
              : "REJECTED";

  const reviewConfidence: PartsFinderConfidenceLabel | null =
    params.decision === "LOW_CONFIDENCE"
      ? "NEEDS_VERIFICATION"
      : params.decision === "VERIFIED"
        ? "VERIFIED_MATCH"
        : params.decision === "LIKELY"
          ? "LIKELY_MATCH"
          : null;

  const normalized = asRecord(base.normalizedJson);
  const vehicleSignature = toVehicleSignature(normalized);
  const partIntentSignature = toIntentSignature(normalized);
  const topRow = ((base.rankedResultsJson as unknown[] | null) ?? [])[0];
  const topRowRecord = asRecord(topRow);
  const candidateSignature =
    typeof topRowRecord.metadataJson === "object" && topRowRecord.metadataJson
      ? String((topRowRecord.metadataJson as Record<string, unknown>).evidenceSignature ?? "")
      : "";
  const shouldApplyCorrection = Boolean(
    (params.correctedPartName && params.correctedPartName.trim().length > 0) ||
      (params.correctedOemCodes && params.correctedOemCodes.length > 0),
  );
  const targetResult = params.resultId
    ? base.results.find((row) => row.id === params.resultId) ?? null
    : base.results[0] ?? null;
  if (shouldApplyCorrection && !targetResult) {
    throw new Error("No result available to apply correction.");
  }
  const candidateBefore = targetResult ? asRecord(targetResult.candidateJson) : null;
  const normalizedCodes = (params.correctedOemCodes ?? [])
    .map((code) => code.trim().toUpperCase())
    .filter((code) => code.length > 0);
  const uniqueCodes = [...new Set(normalizedCodes)];
  const candidateAfter =
    shouldApplyCorrection && candidateBefore
      ? ({
          ...candidateBefore,
          ...(params.correctedPartName && params.correctedPartName.trim().length > 0
            ? { candidatePartName: params.correctedPartName.trim() }
            : {}),
          ...(uniqueCodes.length > 0
            ? {
                oemCodes: uniqueCodes.map((code) => ({ code, label: "Admin corrected" })),
              }
            : {}),
          correctionMeta: {
            correctedBy: params.reviewerId,
            correctedAt: new Date().toISOString(),
          },
        } as Record<string, unknown>)
      : null;
  const nextRankedResults = shouldApplyCorrection
    ? (((base.rankedResultsJson as unknown[] | null) ?? []).map((item, idx) => {
        if (idx !== 0) return item;
        const row = asRecord(item);
        return {
          ...row,
          ...(params.correctedPartName && params.correctedPartName.trim().length > 0
            ? { candidatePartName: params.correctedPartName.trim() }
            : {}),
          ...(uniqueCodes.length > 0 ? { oemCodes: uniqueCodes.map((code) => ({ code, label: "Admin corrected" })) } : {}),
        };
      }) as Prisma.InputJsonValue)
    : undefined;
  const nextRefinedResults = shouldApplyCorrection
    ? (((base.refinedResultsJson as unknown[] | null) ?? []).map((item, idx) => {
        if (idx !== 0) return item;
        const row = asRecord(item);
        return {
          ...row,
          ...(params.correctedPartName && params.correctedPartName.trim().length > 0
            ? { candidatePartName: params.correctedPartName.trim() }
            : {}),
          ...(uniqueCodes.length > 0 ? { oemCodes: uniqueCodes.map((code) => ({ code, label: "Admin corrected" })) } : {}),
        };
      }) as Prisma.InputJsonValue)
    : undefined;

  await prisma.$transaction([
    prisma.partsFinderSearchSessionReview.create({
      data: {
        sessionId: base.id,
        reviewerId: params.reviewerId,
        status: nextStatus,
        confidence: reviewConfidence,
        note: params.adminNote?.trim() ?? null,
        summaryOverride: params.forcedSummary?.trim() ?? null,
        correctedPartName: params.correctedPartName?.trim() || null,
        correctedOemCodes: uniqueCodes.length > 0 ? (uniqueCodes as Prisma.InputJsonValue) : undefined,
        candidateBefore:
          shouldApplyCorrection && candidateBefore
            ? (candidateBefore as Prisma.InputJsonValue)
            : undefined,
        candidateAfter:
          shouldApplyCorrection && candidateAfter
            ? (candidateAfter as Prisma.InputJsonValue)
            : undefined,
      },
    }),
    prisma.partsFinderSearchSession.update({
      where: { id: base.id },
      data: {
        status: nextStatus,
        reviewedById: params.reviewerId,
        reviewedAt: new Date(),
        reviewNote: params.adminNote?.trim() ?? null,
        adminSummaryOverride: params.forcedSummary?.trim() ?? null,
        summaryJson: nextSummary as Prisma.InputJsonValue,
        ...(nextRankedResults ? { rankedResultsJson: nextRankedResults } : {}),
        ...(nextRefinedResults ? { refinedResultsJson: nextRefinedResults } : {}),
      },
    }),
    prisma.partsFinderResult.updateMany({
      where: { sessionId: base.id },
      data: {
        reviewStatus: nextStatus,
        sourcingLinked: params.decision === "FLAGGED_SOURCING",
      },
    }),
    ...(
      shouldApplyCorrection && targetResult && candidateAfter
        ? [
            prisma.partsFinderResult.update({
              where: { id: targetResult.id },
              data: {
                candidateJson: candidateAfter as Prisma.InputJsonValue,
              },
            }),
          ]
        : []
    ),
    ...(
      params.decision === "VERIFIED" || params.decision === "LIKELY" || params.decision === "REJECTED"
        ? [
            prisma.partsFinderVerifiedOutcome.create({
              data: {
                sessionId: base.id,
                resultId: targetResult?.id ?? null,
                vehicleSignature,
                partIntentSignature,
                candidateSignature: candidateSignature || null,
                outcomeStatus: params.decision === "LIKELY" ? "LIKELY" : params.decision,
                note: params.adminNote?.trim() ?? null,
                reviewerId: params.reviewerId,
              },
            }),
          ]
        : []
    ),
    prisma.auditLog.create({
      data: {
        actorId: params.reviewerId,
        action: "parts_finder.review.override",
        entityType: "PartsFinderSession",
        entityId: params.sessionId,
        metadataJson: ({
          summary: nextSummary,
          review: {
            status: params.decision,
            reviewerId: params.reviewerId,
            reviewedAt: new Date().toISOString(),
            adminNote: params.adminNote?.trim() ?? null,
            forcedSummary: params.forcedSummary?.trim() ?? null,
            correctedResultId: targetResult?.id ?? null,
            correctedPartName: params.correctedPartName?.trim() ?? null,
            correctedOemCodes: uniqueCodes,
            beforeCandidate: candidateBefore,
            afterCandidate: candidateAfter,
          },
        } as Prisma.InputJsonValue),
      },
    }),
  ]);
}

export async function getOutcomeLearningSignals(params: {
  normalizedInput: Record<string, unknown>;
  candidateSignatures: string[];
}) {
  const vehicleSignature = toVehicleSignature(params.normalizedInput);
  const partIntentSignature = toIntentSignature(params.normalizedInput);
  const [brand = "", model = ""] = vehicleSignature.split("|");

  const exact = await prisma.partsFinderVerifiedOutcome.findMany({
    where: {
      vehicleSignature,
      partIntentSignature,
      outcomeStatus: { in: ["VERIFIED", "LIKELY", "REJECTED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  const similar = await prisma.partsFinderVerifiedOutcome.findMany({
    where: {
      partIntentSignature,
      outcomeStatus: { in: ["VERIFIED", "LIKELY", "REJECTED"] },
      vehicleSignature: {
        startsWith: [brand, model].filter(Boolean).join("|"),
      },
      NOT: {
        vehicleSignature,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const signatureBoostMap = new Map<string, number>();
  const similarSignatureBoostMap = new Map<string, number>();
  const signatureFilter = new Set(params.candidateSignatures);
  const exactPositive = exact.filter((x) => x.outcomeStatus === "VERIFIED").length;
  const exactLikely = exact.filter((x) => x.outcomeStatus === "LIKELY").length;
  const exactRejected = exact.filter((x) => x.outcomeStatus === "REJECTED").length;
  const similarPositive = similar.filter((x) => x.outcomeStatus === "VERIFIED").length;
  const similarLikely = similar.filter((x) => x.outcomeStatus === "LIKELY").length;
  const similarRejected = similar.filter((x) => x.outcomeStatus === "REJECTED").length;

  for (const row of exact) {
    if (!row.candidateSignature) continue;
    if (signatureFilter.size > 0 && !signatureFilter.has(row.candidateSignature)) continue;
    if (row.outcomeStatus === "VERIFIED") signatureBoostMap.set(row.candidateSignature, 8);
    if (row.outcomeStatus === "LIKELY" && !signatureBoostMap.has(row.candidateSignature)) signatureBoostMap.set(row.candidateSignature, 4);
    if (row.outcomeStatus === "REJECTED") signatureBoostMap.set(row.candidateSignature, -8);
  }
  for (const row of similar) {
    if (!row.candidateSignature) continue;
    if (signatureFilter.size > 0 && !signatureFilter.has(row.candidateSignature)) continue;
    // Similar vehicle outcomes are only soft hints, never strong boosts.
    if (row.outcomeStatus === "VERIFIED" && !similarSignatureBoostMap.has(row.candidateSignature)) {
      similarSignatureBoostMap.set(row.candidateSignature, 2);
    }
    if (row.outcomeStatus === "LIKELY" && !similarSignatureBoostMap.has(row.candidateSignature)) {
      similarSignatureBoostMap.set(row.candidateSignature, 1);
    }
    if (row.outcomeStatus === "REJECTED") {
      similarSignatureBoostMap.set(row.candidateSignature, -2);
    }
  }

  return {
    vehicleSignature,
    partIntentSignature,
    signatureBoostMap,
    similarSignatureBoostMap,
    exactPositive,
    exactLikely,
    exactRejected,
    similarPositive,
    similarLikely,
    similarRejected,
  };
}
