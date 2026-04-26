import { PaymentDisputeStatus, PaymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createLegalAuditLog } from "@/lib/legal-backend-helpers";
import { getRequestIp } from "@/lib/client-ip";
import { transitionPaymentStatus } from "@/lib/payment-lifecycle";
import { prisma } from "@/lib/prisma";
import { rateLimitDispute } from "@/lib/rate-limit";
import { safeAuth } from "@/lib/safe-auth";
import { requireVerification } from "@/lib/identity-verification";

const schema = z.object({
  reason: z.string().min(8).max(3000),
});

type RouteContext = { params: Promise<{ paymentId: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  const ip = getRequestIp(req);
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  const { paymentId } = await ctx.params;
  const rl = await rateLimitDispute(`${session.user.id}:${paymentId}:${ip}`);
  if (!rl.success) {
    return NextResponse.json({ ok: false, error: "Too many dispute attempts. Please try later." }, { status: 429 });
  }
  if (!z.string().cuid().safeParse(paymentId).success) {
    return NextResponse.json({ ok: false, error: "Invalid payment id." }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Reason is required (8+ chars)." }, { status: 400 });
  }

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId: session.user.id },
    select: { id: true, userId: true, status: true },
  });
  if (!payment) {
    return NextResponse.json({ ok: false, error: "Payment not found." }, { status: 404 });
  }

  const existing = await prisma.paymentDispute.findFirst({
    where: { paymentId, status: { in: [PaymentDisputeStatus.OPEN, PaymentDisputeStatus.UNDER_REVIEW] } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ ok: false, error: "A dispute is already open for this payment." }, { status: 409 });
  }

  const reason = parsed.data.reason.trim();
  try {
    await requireVerification({
      userId: session.user.id,
      context: "PAYMENT_DISPUTE",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "IDENTITY_VERIFICATION_REQUIRED") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Identity verification is required before dispute processing. Upload your Ghana Card or valid ID in Dashboard → Verification.",
          code: "IDENTITY_VERIFICATION_REQUIRED",
        },
        { status: 409 },
      );
    }
    throw error;
  }
  const dispute = await prisma.paymentDispute.create({
    data: {
      paymentId,
      reason,
      evidenceNotes: reason,
      status: PaymentDisputeStatus.UNDER_REVIEW,
      flaggedById: session.user.id,
    },
    select: { id: true, status: true, flaggedAt: true },
  });

  if (payment.status !== PaymentStatus.DISPUTED) {
    await transitionPaymentStatus(paymentId, {
      toStatus: PaymentStatus.DISPUTED,
      source: "USER_DISPUTE",
      actorUserId: session.user.id,
      note: "Customer opened dispute. Status moved to DISPUTED for legal review.",
    });
  }

  await createLegalAuditLog({
    actorId: session.user.id,
    targetUserId: payment.userId,
    action: "PAYMENT_DISPUTE_OPENED_BY_USER",
    entityType: "Payment",
    entityId: paymentId,
    metadata: {
      reason,
      paymentId,
      oldStatus: payment.status,
      newStatus: PaymentStatus.DISPUTED,
      disputeId: dispute.id,
      disputeStatus: dispute.status,
      timestamp: dispute.flaggedAt.toISOString(),
    },
  });
  await prisma.legalAuditLog.create({
    data: {
      actorId: session.user.id,
      action: "PAYMENT_DISPUTED",
      entityType: "PAYMENT",
      entityId: paymentId,
    },
  });

  return NextResponse.json({ ok: true, disputeId: dispute.id, status: dispute.status });
}
