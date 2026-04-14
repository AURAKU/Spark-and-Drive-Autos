import { NotificationType, PaymentType } from "@prisma/client";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getVehicleCheckoutAmountGhs } from "@/lib/checkout-amount";
import { customerCheckoutBlockedMessage, getCarCheckoutIneligibleReason } from "@/lib/checkout-eligibility";
import { getGlobalCurrencySettings } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { getRequestIp } from "@/lib/client-ip";
import { rateLimitPayment } from "@/lib/rate-limit";
import { safeAuth } from "@/lib/safe-auth";
import { recordSecurityObservation } from "@/lib/security-observation";

const schema = z.object({
  carId: z.string().cuid(),
  paymentType: z.nativeEnum(PaymentType),
  settlementMethod: z.enum([
    "MOBILE_MONEY",
    "BANK_GHS_COMPANY",
    "ALIPAY_RMB",
    "CASH_OFFICE_GHS",
    "CASH_OFFICE_USD",
  ]),
});

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const userAgent = req.headers.get("user-agent");
  const rl = await rateLimitPayment(`manual:${ip}`);
  if (!rl.success) {
    await recordSecurityObservation({
      severity: "HIGH",
      channel: "RATE_LIMIT",
      title: "Manual payment intent rate-limited",
      ipAddress: ip,
      userAgent,
      path: "/api/payments/create-manual",
      metadataJson: { scope: "pay:manual" },
    });
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const car = await prisma.car.findUnique({ where: { id: parsed.data.carId } });
  if (!car) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }
  const ineligible = getCarCheckoutIneligibleReason(car);
  if (ineligible) {
    return NextResponse.json(
      { error: customerCheckoutBlockedMessage(ineligible), code: ineligible },
      { status: 409 },
    );
  }

  const settings = await getGlobalCurrencySettings();
  const amount = getVehicleCheckoutAmountGhs(Number(car.basePriceRmb), parsed.data.paymentType, settings);
  const reference = `SDA-M-${nanoid(12).toUpperCase()}`;

  const { settlementMethod } = parsed.data;

  const { payment } = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        reference,
        userId: session.user.id,
        carId: car.id,
        orderStatus: "PENDING_PAYMENT",
        paymentType: parsed.data.paymentType,
        amount,
        currency: car.currency,
      },
    });

    const pay = await tx.payment.create({
      data: {
        orderId: order.id,
        userId: session.user.id,
        provider: "MANUAL",
        settlementMethod,
        providerReference: reference,
        amount,
        currency: car.currency,
        status: "AWAITING_PROOF",
        paymentType: parsed.data.paymentType,
        idempotencyKey: reference,
      },
    });

    await tx.paymentStatusHistory.create({
      data: {
        paymentId: pay.id,
        fromStatus: null,
        toStatus: "AWAITING_PROOF",
        source: "MANUAL_INTENT",
        actorUserId: session.user.id,
        note: `Offline settlement selected: ${settlementMethod.replaceAll("_", " ")}`,
      },
    });

    return { payment: pay };
  });

  await prisma.notification.create({
    data: {
      userId: session.user.id,
      type: NotificationType.PAYMENT,
      title: "Payment record created",
      body: "Complete payment using your chosen method and upload a receipt screenshot from your payment page.",
      href: `/dashboard/payments/${payment.id}`,
    },
  });

  return NextResponse.json({
    paymentId: payment.id,
    redirectTo: `/dashboard/payments/${payment.id}`,
  });
}
