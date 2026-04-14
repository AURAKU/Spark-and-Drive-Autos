import {
  NotificationType,
  PaymentProofStatus,
  PaymentSettlementMethod,
  PaymentStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { transitionPaymentStatus } from "@/lib/payment-lifecycle";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  status: z.nativeEnum(PaymentStatus).optional(),
  adminNote: z.string().max(5000).optional().nullable(),
  settlementMethod: z.nativeEnum(PaymentSettlementMethod).optional(),
  proofId: z.string().cuid().optional(),
  proofStatus: z.nativeEnum(PaymentProofStatus).optional(),
  proofAdminNote: z.string().max(2000).optional().nullable(),
});

type RouteContext = { params: Promise<{ paymentId: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { paymentId } = await ctx.params;
  if (!z.string().cuid().safeParse(paymentId).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const adminId = session.user.id;
  const now = new Date();

  if (parsed.data.proofId && parsed.data.proofStatus) {
    const proof = await prisma.paymentProof.findFirst({
      where: { id: parsed.data.proofId, paymentId },
    });
    if (!proof) {
      return NextResponse.json({ error: "Proof not found" }, { status: 404 });
    }
    await prisma.paymentProof.update({
      where: { id: proof.id },
      data: {
        status: parsed.data.proofStatus,
        reviewedById: adminId,
        reviewedAt: now,
        adminNote: parsed.data.proofAdminNote ?? undefined,
      },
    });
    if (payment.userId) {
      await prisma.notification.create({
        data: {
          userId: payment.userId,
          type: NotificationType.PAYMENT,
          title: parsed.data.proofStatus === "APPROVED" ? "Payment proof approved" : "Payment proof rejected",
          body:
            parsed.data.proofAdminNote?.trim() ||
            (parsed.data.proofStatus === "APPROVED"
              ? "Your uploaded receipt was approved."
              : "Please review the note and upload a clearer receipt if needed."),
          href: `/dashboard/payments/${paymentId}`,
        },
      });
    }
  }

  if (parsed.data.adminNote !== undefined) {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { adminNote: parsed.data.adminNote },
    });
  }

  if (parsed.data.settlementMethod !== undefined) {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { settlementMethod: parsed.data.settlementMethod },
    });
    await prisma.paymentStatusHistory.create({
      data: {
        paymentId,
        fromStatus: payment.status,
        toStatus: payment.status,
        source: "ADMIN",
        actorUserId: adminId,
        note: `Settlement method updated to ${parsed.data.settlementMethod.replaceAll("_", " ")}`,
      },
    });
  }

  if (parsed.data.status && parsed.data.status !== payment.status) {
    await transitionPaymentStatus(paymentId, {
      toStatus: parsed.data.status,
      source: "ADMIN",
      actorUserId: adminId,
      note: parsed.data.adminNote ?? `Status set to ${parsed.data.status} by admin`,
      review:
        parsed.data.status === "SUCCESS"
          ? { reviewedById: adminId, reviewedAt: now }
          : undefined,
    });
  }

  const fresh = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      proofs: { orderBy: { createdAt: "desc" } },
      statusHistory: { orderBy: { createdAt: "desc" }, take: 40 },
      user: { select: { email: true, name: true } },
      order: { include: { car: { select: { title: true, slug: true } } } },
    },
  });

  revalidatePath("/admin/payments");
  revalidatePath("/admin/payments/intelligence");
  revalidatePath("/admin/duty");
  revalidatePath(`/admin/payments/${paymentId}`);
  revalidatePath("/dashboard/payments");

  return NextResponse.json({ payment: fresh });
}
