import type { VehicleQueryPayload } from "@/lib/parts-finder/identifier-crypto";
import { logPartsFinderConversion } from "@/lib/parts-finder/conversion";
import type { MembershipAccessSnapshot } from "@/lib/parts-finder/search-types";
import { getPartsFinderSessionForUser } from "@/lib/parts-finder/persistence";
import { queuePartsFinderSearchJob, getPartsFinderSearchJob } from "@/lib/parts-finder/search-job";
import { buildUserSafeSessionPayload } from "@/lib/parts-finder/user-safe-response";
import { prisma } from "@/lib/prisma";

export function submitPartsFinderSearch(
  payload: VehicleQueryPayload,
  userId: string,
  snapshot: MembershipAccessSnapshot,
) {
  return queuePartsFinderSearchJob(payload, userId, snapshot);
}

export function getPartsFinderSearchJobForUser(jobId: string, userId: string) {
  return getPartsFinderSearchJob(jobId, userId);
}

export async function getUserSafePartsFinderSessionResult(sessionId: string, userId: string) {
  const row = await getPartsFinderSessionForUser(sessionId, userId);
  if (!row) return null;
  return {
    ...row,
    metadataJson: buildUserSafeSessionPayload(row.metadataJson),
  };
}

export async function resolvePartsFinderSessionForUserAction(sessionId: string, userId: string) {
  const sessionRow = await getPartsFinderSessionForUser(sessionId, userId);
  if (!sessionRow) return null;
  const sessionEntityId = sessionRow.entityId ?? sessionId;
  const stored = await prisma.partsFinderSearchSession.findFirst({
    where: { sessionId: sessionEntityId, userId },
    select: { id: true },
  });
  return {
    sessionEntityId,
    storedSessionDbId: stored?.id ?? null,
  };
}

export async function saveTopPartsFinderResultForUser(sessionId: string, userId: string) {
  const resolved = await resolvePartsFinderSessionForUserAction(sessionId, userId);
  if (!resolved) {
    throw new Error("Search result session not found.");
  }
  if (resolved.storedSessionDbId) {
    await prisma.partsFinderResult.updateMany({
      where: { sessionId: resolved.storedSessionDbId, isTopResult: true },
      data: { reviewStatus: "LIKELY" },
    });
  }
  await logPartsFinderConversion({
    userId,
    conversionType: "SAVE_RESULT",
    referenceId: resolved.sessionEntityId,
    metadata: { savedAt: new Date().toISOString() },
  });
}

export async function requestPartsFinderSourcingForUser(params: {
  sessionId?: string;
  userId: string;
  note: string;
}) {
  if (params.sessionId) {
    const resolved = await resolvePartsFinderSessionForUserAction(params.sessionId, params.userId);
    if (!resolved) {
      throw new Error("Search result session not found.");
    }
    if (resolved.storedSessionDbId) {
      await prisma.partsFinderResult.updateMany({
        where: { sessionId: resolved.storedSessionDbId, isTopResult: true },
        data: { sourcingLinked: true, reviewStatus: "FLAGGED_SOURCING" },
      });
    }
  }
  await logPartsFinderConversion({
    userId: params.userId,
    conversionType: "REQUEST_SOURCING",
    referenceId: params.sessionId,
    metadata: { note: params.note },
  });
}

export async function logPartsFinderResultConversionForUser(params: {
  sessionId: string;
  userId: string;
  conversionType: "OPEN_CHAT" | "REQUEST_QUOTE";
}) {
  const resolved = await resolvePartsFinderSessionForUserAction(params.sessionId, params.userId);
  if (!resolved) {
    throw new Error("Search result session not found.");
  }
  await logPartsFinderConversion({
    userId: params.userId,
    conversionType: params.conversionType,
    referenceId: resolved.sessionEntityId,
    metadata: { triggeredAt: new Date().toISOString() },
  });
}
