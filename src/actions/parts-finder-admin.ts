"use server";

import { requireAdmin } from "@/lib/auth-helpers";
import { applyPartsFinderReviewOverride, listQueuedPartsFinderReviews } from "@/lib/parts-finder/persistence";
import { partsFinderMembershipAdminSchema, partsFinderReviewOverrideSchema } from "@/lib/parts-finder/schemas";
import { prisma } from "@/lib/prisma";

export async function resolvePartSearchSupportVerification(
  id: string,
  decision: "APPROVED" | "REJECTED",
  note?: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await requireAdmin();
    const input = partsFinderReviewOverrideSchema.parse({
      sessionId: id,
      decision: decision === "APPROVED" ? "APPROVED" : "REJECTED",
      adminNote: note,
    });
    await applyPartsFinderReviewOverride({
      sessionId: input.sessionId,
      reviewerId: session.user.id,
      decision: input.decision,
      adminNote: input.adminNote,
    });
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to update review." };
  }
}

export async function markPartSearchLowConfidence(
  sessionId: string,
  adminNote?: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await requireAdmin();
    const input = partsFinderReviewOverrideSchema.parse({
      sessionId,
      decision: "LOW_CONFIDENCE",
      adminNote,
    });
    await applyPartsFinderReviewOverride({
      sessionId: input.sessionId,
      reviewerId: session.user.id,
      decision: input.decision,
      adminNote: input.adminNote,
    });
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to mark low confidence." };
  }
}

export async function forcePartSearchSummaryEdit(params: {
  sessionId: string;
  forcedSummary: string;
  adminNote?: string;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await requireAdmin();
    const input = partsFinderReviewOverrideSchema.parse({
      sessionId: params.sessionId,
      decision: "APPROVED",
      adminNote: params.adminNote,
      forcedSummary: params.forcedSummary,
    });
    await applyPartsFinderReviewOverride({
      sessionId: input.sessionId,
      reviewerId: session.user.id,
      decision: input.decision,
      adminNote: input.adminNote,
      forcedSummary: input.forcedSummary,
    });
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to force summary edit." };
  }
}

export async function getQueuedPartsFinderSearches() {
  await requireAdmin();
  return listQueuedPartsFinderReviews(120);
}

export async function activateMembershipManually(params: {
  userId: string;
  days?: number;
  reason?: string;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await requireAdmin();
    const input = partsFinderMembershipAdminSchema.parse(params);
    const now = new Date();
    const days = input.days ?? 30;
    const existing = await prisma.partsFinderMembership.findFirst({
      where: { userId: input.userId },
      orderBy: { endsAt: "desc" },
    });
    const start = existing && existing.endsAt > now ? existing.endsAt : now;
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    if (existing) {
      await prisma.partsFinderMembership.update({
        where: { id: existing.id },
        data: {
          status: "ACTIVE",
          startsAt: existing.startsAt,
          endsAt: end,
          suspendedAt: null,
          suspendedBy: null,
          reason: input.reason ?? null,
        },
      });
    } else {
      await prisma.partsFinderMembership.create({
        data: {
          userId: input.userId,
          status: "ACTIVE",
          startsAt: now,
          endsAt: new Date(now.getTime() + days * 24 * 60 * 60 * 1000),
          reason: input.reason ?? null,
        },
      });
    }
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "parts_finder.membership.manual_activate",
        entityType: "PartsFinderMembership",
        entityId: input.userId,
        metadataJson: {
          days: input.days ?? 30,
          reason: input.reason ?? null,
        },
      },
    });
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to activate membership." };
  }
}

export async function suspendMembership(params: {
  userId: string;
  reason?: string;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await requireAdmin();
    const input = partsFinderMembershipAdminSchema.parse(params);
    const existing = await prisma.partsFinderMembership.findFirst({
      where: { userId: input.userId },
      orderBy: { endsAt: "desc" },
    });
    if (!existing) throw new Error("No membership record found for this user.");
    await prisma.partsFinderMembership.update({
      where: { id: existing.id },
      data: {
        status: "SUSPENDED",
        suspendedAt: new Date(),
        suspendedBy: session.user.id,
        reason: input.reason ?? "Suspended by admin.",
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "parts_finder.membership.suspend",
        entityType: "PartsFinderMembership",
        entityId: input.userId,
        metadataJson: { reason: input.reason ?? "Suspended by admin." },
      },
    });
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to suspend membership." };
  }
}

export async function extendMembership(params: {
  userId: string;
  days: number;
  reason?: string;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await requireAdmin();
    const input = partsFinderMembershipAdminSchema.parse(params);
    if (!input.days) throw new Error("Extension days required.");
    const now = new Date();
    const existing = await prisma.partsFinderMembership.findFirst({
      where: { userId: input.userId },
      orderBy: { endsAt: "desc" },
    });
    if (!existing) {
      await prisma.partsFinderMembership.create({
        data: {
          userId: input.userId,
          status: "ACTIVE",
          startsAt: now,
          endsAt: new Date(now.getTime() + input.days * 24 * 60 * 60 * 1000),
          reason: input.reason ?? null,
        },
      });
    } else {
      const base = existing.endsAt > now ? existing.endsAt : now;
      await prisma.partsFinderMembership.update({
        where: { id: existing.id },
        data: {
          status: "ACTIVE",
          suspendedAt: null,
          suspendedBy: null,
          reason: input.reason ?? existing.reason,
          endsAt: new Date(base.getTime() + input.days * 24 * 60 * 60 * 1000),
        },
      });
    }
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "parts_finder.membership.extend",
        entityType: "PartsFinderMembership",
        entityId: input.userId,
        metadataJson: { days: input.days, reason: input.reason ?? null },
      },
    });
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to extend membership." };
  }
}
