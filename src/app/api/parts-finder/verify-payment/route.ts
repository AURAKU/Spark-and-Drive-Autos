import { NextResponse } from "next/server";
import { z } from "zod";

import { transitionPaymentStatus } from "@/lib/payment-lifecycle";
import { getPaystackSecrets } from "@/lib/payment-provider-registry";
import { paystackVerify } from "@/lib/paystack";
import { upsertPartsFinderMembershipForActivation } from "@/lib/parts-finder/activate-membership";
import { PartsFinderAccessError, requirePartsFinderActivationAccess } from "@/lib/parts-finder/access";
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
      select: { id: true, status: true, amount: true, currency: true, createdAt: true, providerReference: true },
    });
    if (!payment) {
      return NextResponse.json({ ok: false, error: "Payment record not found." }, { status: 404 });
    }

    if (payment.status !== "SUCCESS") {
      const { secretKey } = await getPaystackSecrets();
      if (secretKey) {
        const verify = await paystackVerify(input.providerReference, secretKey);
        if (
          verify.status === "success" &&
          verify.currency === payment.currency &&
          verify.amount === Math.round(Number(payment.amount) * 100)
        ) {
          await transitionPaymentStatus(payment.id, {
            toStatus: "SUCCESS",
            source: "CHECKOUT_RETURN",
            note: "Parts Finder activation verified from return callback.",
            receiptData: {
              reference: input.providerReference,
              providerStatus: verify.status,
              amount: verify.amount,
              currency: verify.currency,
            },
          });
        }
      }
    }
    const latest = await prisma.payment.findUnique({
      where: { id: payment.id },
      select: { id: true, status: true, amount: true, currency: true, createdAt: true },
    });
    if (latest?.status === "SUCCESS") {
      await upsertPartsFinderMembershipForActivation(
        session.user.id,
        latest,
        { source: "verify", providerReference: input.providerReference },
      );
    }
    return NextResponse.json({
      ok: true,
      payment: latest ?? payment,
      membershipState: latest?.status === "SUCCESS" ? "ACTIVE" : "PENDING_PAYMENT",
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
