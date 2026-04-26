import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

import { getPaystackCallbackOrigin, getPaystackSecrets } from "@/lib/payment-provider-registry";
import { paystackInitialize } from "@/lib/paystack";
import { POLICY_KEYS } from "@/lib/legal-enforcement";
import { requirePolicy } from "@/lib/legal/guards";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await context.params;
    const requestRow = await prisma.verifiedPartRequest.findFirst({
      where: { id, userId: session.user.id },
      include: { payment: true },
    });
    if (!requestRow) {
      return NextResponse.json({ ok: false, error: "Request not found." }, { status: 404 });
    }
    if (requestRow.status !== "AWAITING_PAYMENT") {
      return NextResponse.json({ ok: false, error: "Request is not awaiting payment." }, { status: 409 });
    }
    const requiredPolicies = [
      POLICY_KEYS.PLATFORM_TERMS_PRIVACY,
      POLICY_KEYS.CHECKOUT_AGREEMENT,
      POLICY_KEYS.PARTS_FINDER_DISCLAIMER,
      POLICY_KEYS.VERIFIED_PART_REQUEST_TERMS,
    ] as const;
    for (const key of requiredPolicies) {
      try {
        await requirePolicy(session.user.id, key);
      } catch {
        return NextResponse.json(
          {
            ok: false,
            code: "LEGAL_ACCEPTANCE_REQUIRED",
            policyKey: key,
            error: "Please accept required legal terms before payment.",
            redirectTo: "/dashboard",
          },
          { status: 409 },
        );
      }
    }

    const reference = `SDA-VPR-${nanoid(10).toUpperCase()}`;
    const callbackOrigin = await getPaystackCallbackOrigin();
    const callbackUrl = `${callbackOrigin}/dashboard/verified-parts/${encodeURIComponent(requestRow.id)}?reference=${encodeURIComponent(reference)}`;
    const payment =
      requestRow.payment ??
      (await prisma.payment.create({
        data: {
          userId: session.user.id,
          provider: "PAYSTACK",
          settlementMethod: "PAYSTACK",
          providerReference: reference,
          amount: requestRow.verificationFee,
          currency: requestRow.currency,
          status: "PENDING",
          paymentType: "VERIFIED_PART_REQUEST",
          idempotencyKey: reference,
          methodDetails: {
            paymentType: "VERIFIED_PART_REQUEST",
            verifiedPartRequestId: requestRow.id,
            userId: session.user.id,
            requestNumber: requestRow.requestNumber,
          },
        },
      }));
    await prisma.verifiedPartRequest.update({
      where: { id: requestRow.id },
      data: { paymentId: payment.id },
    });

    const { secretKey } = await getPaystackSecrets();
    if (!secretKey) {
      return NextResponse.json({ ok: false, error: "Paystack not configured." }, { status: 500 });
    }
    const init = await paystackInitialize({
      email: session.user.email ?? "",
      amountMinorUnits: Math.round(Number(requestRow.verificationFee) * 100),
      reference: payment.providerReference ?? reference,
      currency: requestRow.currency,
      metadata: {
        paymentType: "VERIFIED_PART_REQUEST",
        verifiedPartRequestId: requestRow.id,
        userId: session.user.id,
        requestNumber: requestRow.requestNumber,
      },
      callbackUrl,
      secretKey,
    });
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "verified_part_request.payment_initialized",
        entityType: "VerifiedPartRequest",
        entityId: requestRow.id,
        metadataJson: { reference: payment.providerReference, paymentId: payment.id },
      },
    });
    return NextResponse.json({ ok: true, authorizationUrl: init.authorization_url, reference: init.reference });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        {
          ok: false,
          code: "AUTH_REQUIRED",
          error: "Please sign in to continue.",
          redirectTo: "/login?callbackUrl=/parts-finder/search",
        },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "We could not complete this action. Please try again." },
      { status: 400 },
    );
  }
}
