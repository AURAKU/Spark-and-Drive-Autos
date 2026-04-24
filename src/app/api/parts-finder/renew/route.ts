import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { PartsFinderAccessError, requirePartsFinderActivationAccess } from "@/lib/parts-finder/access";
import { getPartsFinderActivationSnapshot } from "@/lib/parts-finder/pricing";
import { getDefaultPaymentProvider, getPaystackCallbackOrigin, getPaystackSecrets } from "@/lib/payment-provider-registry";
import { paystackInitialize } from "@/lib/paystack";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const { session } = await requirePartsFinderActivationAccess();
    const snapshot = await getPartsFinderActivationSnapshot();
    if (!session.user.email) {
      return NextResponse.json({ ok: false, error: "Account email missing." }, { status: 400 });
    }

    const selectedProvider = await getDefaultPaymentProvider();
    if (selectedProvider !== "PAYSTACK") {
      return NextResponse.json({ ok: false, error: "Only Paystack is supported for Parts Finder renewal right now." }, { status: 409 });
    }
    const { secretKey } = await getPaystackSecrets();
    if (!secretKey) {
      return NextResponse.json({ ok: false, error: "Paystack is not configured for renewal payments." }, { status: 500 });
    }

    const amount = snapshot.renewalPriceMinor / 100;
    const reference = `SDA-PF-REN-${nanoid(10).toUpperCase()}`;
    const callbackOrigin = await getPaystackCallbackOrigin();
    const callbackUrl = `${callbackOrigin}/parts-finder/activate?reference=${encodeURIComponent(reference)}`;
    const payment = await prisma.payment.create({
      data: {
        userId: session.user.id,
        provider: "PAYSTACK",
        settlementMethod: "PAYSTACK",
        providerReference: reference,
        amount,
        currency: snapshot.currency,
        status: "PENDING",
        paymentType: "PARTS_FINDER_MEMBERSHIP",
        idempotencyKey: reference,
        methodDetails: {
          flow: "RENEW",
          durationDays: snapshot.renewalDurationDays,
        },
      },
      select: { id: true, providerReference: true, amount: true, currency: true, status: true },
    });
    const init = await paystackInitialize({
      email: session.user.email,
      amountMinorUnits: Math.round(amount * 100),
      reference,
      currency: snapshot.currency,
      metadata: {
        paymentId: payment.id,
        flow: "PARTS_FINDER_RENEW",
        userId: session.user.id,
      },
      callbackUrl,
      secretKey,
    });

    return NextResponse.json({
      ok: true,
      message: `Renewal initialized (${snapshot.renewalDurationDays} day extension).`,
      payment,
      authorizationUrl: init.authorization_url,
      reference: init.reference,
    });
  } catch (error) {
    if (error instanceof PartsFinderAccessError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code, redirectTo: error.redirectTo },
        { status: error.status },
      );
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Renewal failed." }, { status: 400 });
  }
}
