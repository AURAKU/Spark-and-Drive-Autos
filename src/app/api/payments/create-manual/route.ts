import { NotificationType, OrderKind, PaymentType, Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getVehicleCheckoutAmountGhs } from "@/lib/checkout-amount";
import { customerCheckoutBlockedMessage, getCarCheckoutIneligibleReason } from "@/lib/checkout-eligibility";
import { isCheckoutConflictError, throwCheckoutConflict } from "@/lib/checkout-transaction-errors";
import { getGlobalCurrencySettings } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { getRequestIp } from "@/lib/client-ip";
import { rateLimitPayment } from "@/lib/rate-limit";
import { safeAuth } from "@/lib/safe-auth";
import { recordSecurityObservation } from "@/lib/security-observation";
import { carHasSuccessfulVehiclePayment } from "@/lib/sold-vehicle";

const schema = z.object({
  carId: z.string().cuid(),
  paymentType: z.nativeEnum(PaymentType),
  settlementMethod: z.enum([
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
  if (await carHasSuccessfulVehiclePayment(car.id)) {
    return NextResponse.json(
      { error: customerCheckoutBlockedMessage("VEHICLE_SOLD"), code: "VEHICLE_SOLD" },
      { status: 409 },
    );
  }

  const settings = await getGlobalCurrencySettings();
  const reference = `SDA-M-${nanoid(12).toUpperCase()}`;

  const { settlementMethod } = parsed.data;

  let payment: { id: string };
  try {
    const out = await prisma.$transaction(
      async (tx) => {
        const carFresh = await tx.car.findUnique({ where: { id: parsed.data.carId } });
        if (!carFresh) throwCheckoutConflict("CAR_NOT_FOUND");
        const block = getCarCheckoutIneligibleReason(carFresh);
        if (block) throwCheckoutConflict("INELIGIBLE", block);
        const dup = await tx.payment.findFirst({
          where: {
            status: "SUCCESS",
            order: { carId: carFresh.id, kind: OrderKind.CAR },
          },
          select: { id: true },
        });
        if (dup) throwCheckoutConflict("ALREADY_PURCHASED");
        const amountTx = getVehicleCheckoutAmountGhs(Number(carFresh.basePriceRmb), parsed.data.paymentType, settings);
        const order = await tx.order.create({
          data: {
            reference,
            userId: session.user.id,
            carId: carFresh.id,
            kind: OrderKind.CAR,
            orderStatus: "PENDING_PAYMENT",
            paymentType: parsed.data.paymentType,
            amount: amountTx,
            currency: carFresh.currency,
          },
        });

        const pay = await tx.payment.create({
          data: {
            orderId: order.id,
            userId: session.user.id,
            provider: "MANUAL",
            settlementMethod,
            providerReference: reference,
            amount: amountTx,
            currency: carFresh.currency,
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
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 20_000,
      },
    );
    payment = out.payment;
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") {
      return NextResponse.json({ error: "Please try again in a moment.", code: "SERIALIZATION_RETRY" }, { status: 409 });
    }
    if (isCheckoutConflictError(e)) {
      if (e.checkoutCode === "CAR_NOT_FOUND") {
        return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
      }
      if (e.checkoutCode === "INELIGIBLE" && e.checkoutReason) {
        return NextResponse.json(
          { error: customerCheckoutBlockedMessage(e.checkoutReason), code: e.checkoutReason },
          { status: 409 },
        );
      }
      if (e.checkoutCode === "ALREADY_PURCHASED") {
        return NextResponse.json(
          { error: customerCheckoutBlockedMessage("VEHICLE_SOLD"), code: "VEHICLE_SOLD" },
          { status: 409 },
        );
      }
    }
    throw e;
  }

  await prisma.notification.create({
    data: {
      userId: session.user.id,
      type: NotificationType.PAYMENT,
      title: "Secure your vehicle — upload payment proof",
      body:
        "Complete your payment using the bank, Alipay, or cash instructions on file. Then upload a clear screenshot or official receipt on your payment page so our team can verify it. Approval confirms your purchase and generates your official receipt.",
      href: `/dashboard/payments/${payment.id}`,
    },
  });

  const redirectTo =
    settlementMethod === "ALIPAY_RMB"
      ? `/dashboard/payments/${payment.id}?alipay=1`
      : `/dashboard/payments/${payment.id}`;

  return NextResponse.json({
    paymentId: payment.id,
    redirectTo,
  });
}
