import { NextResponse } from "next/server";
import { z } from "zod";

import { PartsFinderAccessError, requirePartsFinderAdmin } from "@/lib/parts-finder/access";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  action: z.enum(["ACTIVATE", "DEACTIVATE", "SUSPEND", "EXTEND", "UNSUSPEND"]),
  userId: z.string().min(1),
  days: z.number().int().min(1).max(365).optional(),
  reason: z.string().trim().max(1000).optional(),
});

export async function POST(request: Request) {
  try {
    const { session } = await requirePartsFinderAdmin();
    const contentType = request.headers.get("content-type") ?? "";
    const raw =
      contentType.includes("application/json")
        ? await request.json()
        : Object.fromEntries((await request.formData()).entries());
    const input = schema.parse({
      ...raw,
      days: raw && typeof (raw as Record<string, unknown>).days === "string"
        ? Number.parseInt((raw as Record<string, string>).days, 10)
        : (raw as Record<string, unknown>).days,
    });
    const normalizedAction = input.action === "DEACTIVATE" ? "SUSPEND" : input.action;
    const actionMap = {
      ACTIVATE: "parts_finder.membership.manual_activate",
      DEACTIVATE: "parts_finder.membership.deactivate",
      SUSPEND: "parts_finder.membership.suspend",
      EXTEND: "parts_finder.membership.extend",
      UNSUSPEND: "parts_finder.membership.unsuspend",
    } as const;
    const now = new Date();
    const existing = await prisma.partsFinderMembership.findFirst({
      where: { userId: input.userId },
      orderBy: { endsAt: "desc" },
    });
    if (normalizedAction === "SUSPEND") {
      if (!existing) throw new Error("Membership not found.");
      await prisma.partsFinderMembership.update({
        where: { id: existing.id },
        data: {
          status: "SUSPENDED",
          suspendedAt: now,
          suspendedBy: session.user.id,
          reason: input.reason ?? "Suspended by admin.",
        },
      });
    } else if (normalizedAction === "UNSUSPEND") {
      if (!existing) throw new Error("Membership not found.");
      await prisma.partsFinderMembership.update({
        where: { id: existing.id },
        data: {
          status: existing.endsAt > now ? "ACTIVE" : "EXPIRED",
          suspendedAt: null,
          suspendedBy: null,
          reason: input.reason ?? existing.reason,
        },
      });
    } else if (normalizedAction === "EXTEND") {
      const days = input.days ?? 30;
      if (!existing) {
        await prisma.partsFinderMembership.create({
          data: {
            userId: input.userId,
            status: "ACTIVE",
            startsAt: now,
            endsAt: new Date(now.getTime() + days * 24 * 60 * 60 * 1000),
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
            endsAt: new Date(base.getTime() + days * 24 * 60 * 60 * 1000),
            reason: input.reason ?? existing.reason,
          },
        });
      }
    } else {
      const days = input.days ?? 30;
      const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      if (!existing) {
        await prisma.partsFinderMembership.create({
          data: {
            userId: input.userId,
            status: "ACTIVE",
            startsAt: now,
            endsAt: end,
            reason: input.reason ?? null,
          },
        });
      } else {
        await prisma.partsFinderMembership.update({
          where: { id: existing.id },
          data: {
            status: "ACTIVE",
            startsAt: existing.startsAt,
            endsAt: existing.endsAt > end ? existing.endsAt : end,
            suspendedAt: null,
            suspendedBy: null,
            reason: input.reason ?? existing.reason,
          },
        });
      }
    }
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: actionMap[input.action],
        entityType: "PartsFinderMembership",
        entityId: input.userId,
        metadataJson: {
          requestedAction: input.action,
          appliedAction: normalizedAction,
          days: normalizedAction === "EXTEND" ? (input.days ?? 30) : input.days ?? null,
          reason: input.reason ?? null,
        },
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PartsFinderAccessError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code, redirectTo: error.redirectTo },
        { status: error.status },
      );
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Membership action failed." }, { status: 400 });
  }
}
