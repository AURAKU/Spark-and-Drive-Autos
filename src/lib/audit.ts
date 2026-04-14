"use server";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type AuditInput = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadataJson?: Prisma.InputJsonValue;
  ipAddress?: string | null;
};

type AuditDb = Pick<Prisma.TransactionClient, "auditLog">;

export async function writeAuditLog(input: AuditInput, tx?: AuditDb) {
  const db = tx ?? prisma;
  await db.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadataJson: input.metadataJson,
      ipAddress: input.ipAddress ?? null,
    },
  });
}
