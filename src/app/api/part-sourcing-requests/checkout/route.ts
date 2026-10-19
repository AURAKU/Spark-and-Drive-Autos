import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestIp } from "@/lib/client-ip";
import { isAllowedPartSourcingImageUrl } from "@/lib/part-sourcing-image-url";
import { getPaystackCallbackOrigin, getPaystackSecrets } from "@/lib/payment-provider-registry";
import { paystackInitialize } from "@/lib/paystack";
import { PARTS_REQUEST_FEE_KIND, fulfillPaidPartsRequest, getPartsRequestFeeSettings } from "@/lib/parts-request-fee";
import { prisma } from "@/lib/prisma";
import { rateLimitForm } from "@/lib/rate-limit";
import { sanitizePlainText } from "@/lib/sanitize";
import { safeAuth } from "@/lib/safe-auth";
import { applyWalletLedgerEntry } from "@/lib/wallet-ledger";

const MAX_IMAGES = 8;

const optionalTrim = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value == null) return null;
      const trimmed = String(value).trim();
      return trimmed.length ? trimmed.slice(0, max) : null;
    });

const schema = z.object({
  method: z.enum(["wallet", "paystack"]),
  summaryTitle: optionalTrim(200),
  description: z.string().trim().min(10).max(8000),
  vehicleMake: optionalTrim(80),
  vehicleModel: optionalTrim(80),
  vehicleYear: z.number().int().min(1950).max(2035).optional().nullable(),
  partNumber: optionalTrim(120),
  quantity: z.number().int().min(1).max(999).optional().default(1),
  urgency: z.enum(["normal", "soon", "urgent"]).optional().default("normal"),
  deliveryCity: optionalTrim(120),
  imageUrls: z.array(z.string().url()).max(MAX_IMAGES).optional().default([]),
  guestName: optionalTrim(120),
  guestEmail: z.string().trim().email().max(160).optional().nullable(),
  guestPhone: optionalTrim(40),
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const limited = await rateLimitForm(`partsreq-pay:${ip}`);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many attempts. Please wait." }, { status: 429 });
  }

  const session = await safeAuth();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the request details and try again." }, { status: 400 });
  }
  const input = parsed.data;
  for (const url of input.imageUrls ?? []) {
    if (!isAllowedPartSourcingImageUrl(url)) {
      return NextResponse.json({ error: "One or more image links are invalid." }, { status: 400 });
    }
  }

  const settings = await getPartsRequestFeeSettings();
  if (!settings.enabled) {
    return NextResponse.json({ error: "Parts requests are paused. Please try again later." }, { status: 409 });
  }
  const feeGhs = Number(settings.feeAmount);
  if (!Number.isFinite(feeGhs) || feeGhs <= 0) {
    return NextResponse.json({ error: "The request fee is not available." }, { status: 409 });
  }

  const userId = session?.user?.id ?? null;
  let guestName = input.guestName ? sanitizePlainText(input.guestName, 120) : null;
  let guestEmail = input.guestEmail?.toLowerCase() ?? null;
  let guestPhone = input.guestPhone ? sanitizePlainText(input.guestPhone, 40) : null;
  if (!userId && (!guestName || !guestEmail || !guestPhone)) {
    return NextResponse.json({ error: "Name, email, and phone are required to send this request." }, { status: 400 });
  }
  if (userId) {
    guestName = null;
    guestEmail = session?.user?.email?.toLowerCase() ?? null;
    guestPhone = null;
  }
  if (input.method === "wallet" && !userId) {
    return NextResponse.json({ error: "Sign in to pay from your wallet, or pay with Paystack." }, { status: 401 });
  }

  const cookieStore = await cookies();
  let guestToken = userId ? null : cookieStore.get("sda_guest")?.value ?? null;
  let newGuestCookie: string | null = null;
  if (!userId && !guestToken) {
    guestToken = `gst_${randomUUID().replaceAll("-", "")}`;
    newGuestCookie = guestToken;
  }

  const urgencyLabel = input.urgency === "urgent" ? "Urgent" : input.urgency === "soon" ? "Within a few weeks" : "Normal";
  const reference = `SDA-PSR-${nanoid(12).toUpperCase()}`;
  const payment = await prisma.payment.create({
    data: {
      userId,
      provider: input.method === "wallet" ? "MANUAL" : "PAYSTACK",
      settlementMethod: input.method === "wallet" ? "BANK_GHS_COMPANY" : "PAYSTACK",
      providerReference: reference,
      amount: feeGhs,
      currency: "GHS",
      status: "PENDING",
      paymentType: "SOURCING_FEE",
      idempotencyKey: reference,
      methodDetails: { kind: PARTS_REQUEST_FEE_KIND, userId },
    },
  });
  const requestRow = await prisma.partSourcingRequest.create({
    data: {
      userId,
      guestName,
      guestEmail,
      guestPhone,
      guestToken,
      summaryTitle: input.summaryTitle ? sanitizePlainText(input.summaryTitle, 200) : null,
      description: sanitizePlainText(input.description, 8000),
      vehicleMake: input.vehicleMake ? sanitizePlainText(input.vehicleMake, 80) : null,
      vehicleModel: input.vehicleModel ? sanitizePlainText(input.vehicleModel, 80) : null,
      vehicleYear: input.vehicleYear ?? null,
      partNumber: input.partNumber ? sanitizePlainText(input.partNumber, 120) : null,
      quantity: input.quantity ?? 1,
      urgency: urgencyLabel,
      deliveryCity: input.deliveryCity ? sanitizePlainText(input.deliveryCity, 120) : null,
      imageUrls: input.imageUrls ?? [],
      paymentState: "AWAITING_PAYMENT",
      feeGhs,
      paymentId: payment.id,
    },
  });

  const respond = (body: Record<string, unknown>, status = 200) => {
    const res = NextResponse.json(body, { status });
    if (newGuestCookie) {
      res.cookies.set("sda_guest", newGuestCookie, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    }
    return res;
  };

  if (input.method === "wallet" && userId) {
    try {
      await applyWalletLedgerEntry({
        userId,
        reference,
        amount: feeGhs,
        currency: "GHS",
        provider: "MANUAL",
        method: "BANK_GHS_COMPANY",
        direction: "DEBIT",
        purpose: "PARTS_PURCHASE",
        providerPayload: { kind: PARTS_REQUEST_FEE_KIND, requestId: requestRow.id },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Wallet payment failed.";
      return respond({ error: message }, 409);
    }
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCESS", paidAt: new Date() } });
    const paid = await fulfillPaidPartsRequest(payment.id);
    return respond({ ok: true, requestId: paid?.id ?? requestRow.id, threadId: paid?.chatThreadId ?? null });
  }

  const { secretKey } = await getPaystackSecrets();
  if (!secretKey) {
    return respond({ error: "Paystack is not configured yet." }, 503);
  }
  const email = userId ? session?.user?.email : guestEmail;
  if (!email) {
    return respond({ error: "An email address is required for payment." }, 400);
  }
  const callbackOrigin = await getPaystackCallbackOrigin();
  const callbackUrl = `${callbackOrigin}/request-autoparts?reference=${encodeURIComponent(reference)}`;
  const init = await paystackInitialize({
    email,
    amountMinorUnits: Math.round(feeGhs * 100),
    reference,
    currency: "GHS",
    callbackUrl,
    metadata: { kind: PARTS_REQUEST_FEE_KIND, requestId: requestRow.id, userId },
    secretKey,
  });
  return respond({ ok: true, authorizationUrl: init.authorization_url, reference: init.reference, requestId: requestRow.id });
}
