import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type LegalAuditInput = {
  actorId?: string | null;
  targetUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function writeLegalAuditLog(input: LegalAuditInput) {
  await prisma.legalAuditLog.create({
    data: {
      actorId: input.actorId ?? null,
      targetUserId: input.targetUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ? input.userAgent.slice(0, 512) : null,
    },
  });
}
