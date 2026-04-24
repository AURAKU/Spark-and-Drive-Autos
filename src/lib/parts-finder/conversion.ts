import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { ParsedVehicleData, SearchPipelineResultRow } from "@/lib/parts-finder/search-types";

export async function logPartsFinderConversion(params: {
  userId?: string;
  conversionType: "REQUEST_SOURCING" | "SAVE_RESULT" | "OPEN_CHAT" | "REQUEST_QUOTE";
  referenceId?: string;
  metadata?: Record<string, unknown>;
}) {
  if (params.userId && params.referenceId) {
    const session = await prisma.partsFinderSearchSession.findFirst({
      where: { sessionId: params.referenceId, userId: params.userId },
      select: { id: true },
    });
    if (session) {
      await prisma.partsFinderConversion.create({
        data: {
          userId: params.userId,
          sessionId: session.id,
          conversionType: params.conversionType,
          metadataJson: (params.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
        },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      actorId: params.userId ?? null,
      action: `parts_finder.conversion.${params.conversionType.toLowerCase()}`,
      entityType: "PartsFinderConversion",
      entityId: params.referenceId ?? null,
      metadataJson: (params.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
    },
  });
}

export function normalizeFitmentDisplay(vehicle: ParsedVehicleData, rows: SearchPipelineResultRow[]) {
  return rows.map((row) => ({
    ...row,
    fitmentNotes:
      row.fitmentNotes ??
      [vehicle.brand, vehicle.model, vehicle.year != null ? String(vehicle.year) : null].filter(Boolean).join(" · "),
  }));
}
