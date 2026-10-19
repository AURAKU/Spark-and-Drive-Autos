import { NextResponse } from "next/server";

import { paystackVerify } from "@/lib/paystack";
import { getPaystackSecrets } from "@/lib/payment-provider-registry";
import { PARTS_REQUEST_FEE_KIND, fulfillPaidPartsRequest } from "@/lib/parts-request-fee";
import { prisma } from "@/lib/prisma";
import { transitionPaymentStatus } from "@/lib/payment-lifecycle";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const reference = new URL(req.url).searchParams.get("reference")?.trim() ?? "";
  if (!reference) return NextResponse.json({ error: "Missing payment reference." }, { status: 400 });

  const payment = await prisma.payment.findUnique({ where: { providerReference: reference } });
  const details = payment?.methodDetails;
  const kind = details && typeof details === "object" && !Array.isArray(details) ? (details as { kind?: string }).kind : null;
  if (!payment || payment.paymentType !== "SOURCING_FEE" || kind !== PARTS_REQUEST_FEE_KIND) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  if (payment.status !== "SUCCESS") {
    const { secretKey } = await getPaystackSecrets();
    if (!secretKey) return NextResponse.json({ error: "Payment is still pending." }, { status: 409 });
    let verified: { status: string; currency: string; amount: number };
    try {
      verified = await paystackVerify(reference, secretKey);
    } catch {
      return NextResponse.json({ ok: false, pending: true });
    }
    if (verified.status !== "success" || verified.currency !== payment.currency) {
      return NextResponse.json({ ok: false, pending: true });
    }
    if (verified.amount !== Math.round(Number(payment.amount) * 100)) {
      return NextResponse.json({ error: "Payment amount did not match." }, { status: 409 });
    }
    await transitionPaymentStatus(payment.id, {
      toStatus: "SUCCESS",
      source: "CHECKOUT_RETURN",
      note: "Parts request fee confirmed on return",
      providerVerified: true,
    });
  }

  const request = await fulfillPaidPartsRequest(payment.id);
  return NextResponse.json({
    ok: request?.paymentState === "PAID",
    requestId: request?.id ?? null,
    threadId: request?.chatThreadId ?? null,
  });
}
