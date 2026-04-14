import type { LeadSourceChannel, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function ensureLead(input: {
  customerId?: string | null;
  sourceChannel: LeadSourceChannel;
  title?: string;
}) {
  if (!input.customerId) return null;
  const existing = await prisma.lead.findFirst({
    where: { customerId: input.customerId, stage: { notIn: ["CLOSED", "LOST", "DELIVERED"] } },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return existing;
  return prisma.lead.create({
    data: {
      customerId: input.customerId,
      sourceChannel: input.sourceChannel,
      title: input.title ?? "New lead",
    },
  });
}

export async function auditLog(actorId: string | null, action: string, entityType: string, entityId?: string, metadata?: Prisma.InputJsonValue) {
  await prisma.auditLog.create({
    data: {
      actorId: actorId ?? undefined,
      action,
      entityType,
      entityId: entityId ?? null,
      metadataJson: metadata ?? undefined,
    },
  });
}
