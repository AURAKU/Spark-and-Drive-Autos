import type { Prisma } from "@prisma/client";

import { getPartsFinderActivationSnapshot } from "@/lib/parts-finder/pricing";
import { prisma } from "@/lib/prisma";

type PaymentLike = { id: string; createdAt: Date };

/**
 * Creates or extends Parts Finder membership after a successful PARTS_FINDER_MEMBERSHIP payment
 * (Paystack, wallet, or admin).
 */
export async function upsertPartsFinderMembershipForActivation(
  userId: string,
  payment: PaymentLike,
  metadata?: { source?: string; providerReference?: string },
  dbOrTx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const db = dbOrTx;
  const snapshot = await getPartsFinderActivationSnapshot();
  const now = payment.createdAt;
  const existing = await db.partsFinderMembership.findFirst({
    where: { userId },
    orderBy: { endsAt: "desc" },
  });
  const durationDays =
    !existing
      ? snapshot.defaultDurationDays
      : existing.endsAt.getTime() <= now.getTime()
        ? snapshot.renewalDurationDays
        : snapshot.defaultDurationDays;
  const base = existing && existing.endsAt > now ? existing.endsAt : now;
  const nextEndsAt = new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000);
  if (existing) {
    await db.partsFinderMembership.update({
      where: { id: existing.id },
      data: {
        status: "ACTIVE",
        suspendedAt: null,
        suspendedBy: null,
        endsAt: nextEndsAt,
      },
    });
  } else {
    await db.partsFinderMembership.create({
      data: {
        userId,
        status: "ACTIVE",
        startsAt: now,
        endsAt: nextEndsAt,
      },
    });
  }
  await db.auditLog.create({
    data: {
      actorId: userId,
      action: "parts_finder.membership.auto_activated",
      entityType: "PartsFinderMembership",
      entityId: userId,
        metadataJson: {
        paymentId: payment.id,
        durationDaysApplied: durationDays,
        source: metadata?.source ?? "payment",
        providerReference: metadata?.providerReference ?? null,
      },
    },
  });
}
