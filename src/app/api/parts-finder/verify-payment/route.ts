import { NextResponse } from "next/server";
import { z } from "zod";

import { PartsFinderAccessError, requirePartsFinderActivationAccess } from "@/lib/parts-finder/access";
import { getPartsFinderActivationSnapshot } from "@/lib/parts-finder/pricing";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  providerReference: z.string().min(3),
});

export async function POST(request: Request) {
  try {
    const { session } = await requirePartsFinderActivationAccess();
    const input = schema.parse(await request.json());
    const payment = await prisma.payment.findFirst({
      where: {
        providerReference: input.providerReference,
        userId: session.user.id,
        paymentType: "PARTS_FINDER_MEMBERSHIP",
      },
      select: { id: true, status: true, amount: true, currency: true, createdAt: true },
    });
    if (payment?.status === "SUCCESS") {
      const snapshot = await getPartsFinderActivationSnapshot();
      const now = payment.createdAt;
      const existing = await prisma.partsFinderMembership.findFirst({
        where: { userId: session.user.id },
        orderBy: { endsAt: "desc" },
      });
      const base = existing && existing.endsAt > now ? existing.endsAt : now;
      const nextEndsAt = new Date(base.getTime() + snapshot.defaultDurationDays * 24 * 60 * 60 * 1000);
      if (existing) {
        await prisma.partsFinderMembership.update({
          where: { id: existing.id },
          data: {
            status: "ACTIVE",
            suspendedAt: null,
            suspendedBy: null,
            endsAt: nextEndsAt,
          },
        });
      } else {
        await prisma.partsFinderMembership.create({
          data: {
            userId: session.user.id,
            status: "ACTIVE",
            startsAt: now,
            endsAt: nextEndsAt,
          },
        });
      }
      await prisma.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "parts_finder.membership.auto_activated",
          entityType: "PartsFinderMembership",
          entityId: session.user.id,
          metadataJson: {
            providerReference: input.providerReference,
            paymentId: payment.id,
            durationDaysApplied: snapshot.defaultDurationDays,
          },
        },
      });
    }
    return NextResponse.json({
      ok: true,
      payment,
      membershipState: payment?.status === "SUCCESS" ? "ACTIVE" : "PENDING_PAYMENT",
    });
  } catch (error) {
    if (error instanceof PartsFinderAccessError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code, redirectTo: error.redirectTo },
        { status: error.status },
      );
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Verification failed." }, { status: 400 });
  }
}
