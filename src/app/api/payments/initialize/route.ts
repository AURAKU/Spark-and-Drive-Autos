import { PaymentType } from "@prisma/client";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getDefaultPaymentProvider,
  getPaystackCallbackOrigin,
  getPaystackSecrets,
} from "@/lib/payment-provider-registry";
import { customerCheckoutBlockedMessage, getCarCheckoutIneligibleReason } from "@/lib/checkout-eligibility";
import { getVehicleCheckoutAmountGhs } from "@/lib/checkout-amount";
import { getGlobalCurrencySettings } from "@/lib/currency";
import { requiresRiskAcknowledgement, requiresSourcingContract } from "@/lib/legal-enforcement";
import { logRiskEvent } from "@/lib/risk-engine";
import { safeAuth } from "@/lib/safe-auth";
import { paystackInitialize } from "@/lib/paystack";
import { prisma } from "@/lib/prisma";
import { getRequestIp } from "@/lib/client-ip";
import { rateLimitPayment } from "@/lib/rate-limit";
import { recordSecurityObservation } from "@/lib/security-observation";

const schema = z.object({
  carId: z.string().cuid(),
  paymentType: z.nativeEnum(PaymentType),
  agreementAccepted: z.boolean(),
  agreementVersion: z.string().min(1).max(40),
  contractAccepted: z.boolean().optional(),
  contractVersion: z.string().min(1).max(40).optional(),
  riskAccepted: z.boolean().optional(),
  riskVersion: z.string().min(1).max(40).optional(),
});

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const userAgent = req.headers.get("user-agent");
  const rl = await rateLimitPayment(`init:${ip}`);
  if (!rl.success) {
    await recordSecurityObservation({
      severity: "HIGH",
      channel: "RATE_LIMIT",
      title: "Vehicle checkout payment init rate-limited",
      ipAddress: ip,
      userAgent,
      path: "/api/payments/initialize",
    });
    return NextResponse.json({ error: "Too many payment attempts" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const session = await safeAuth();
  if (!session?.user?.id) {
    await recordSecurityObservation({
      severity: "MEDIUM",
      channel: "PAYMENT",
      title: "Payment initialize without session",
      ipAddress: ip,
      userAgent,
      path: "/api/payments/initialize",
    });
    return NextResponse.json(
      { error: "Sign in to complete payment", code: "AUTH_REQUIRED" },
      { status: 401 },
    );
  }
  const email = session.user.email;
  if (!email) {
    return NextResponse.json({ error: "Account email missing" }, { status: 400 });
  }

  const car = await prisma.car.findUnique({ where: { id: parsed.data.carId } });
  if (!car) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }
  const ineligible = getCarCheckoutIneligibleReason(car);
  if (ineligible) {
    return NextResponse.json(
      {
        error: customerCheckoutBlockedMessage(ineligible),
        code: ineligible,
      },
      { status: 409 },
    );
  }
  if (!parsed.data.agreementAccepted) {
    return NextResponse.json({ error: "You must accept checkout agreement before payment." }, { status: 400 });
  }
  if (requiresSourcingContract(car.sourceType) && !parsed.data.contractAccepted) {
    await logRiskEvent({
      userId: session.user.id,
      type: "missing_contract_acceptance_attempt",
      severity: "medium",
      meta: { sourceType: car.sourceType, carId: car.id },
    });
    return NextResponse.json({ error: "Sourcing contract acceptance is required." }, { status: 400 });
  }
  if (requiresRiskAcknowledgement(car.sourceType) && !parsed.data.riskAccepted) {
    await logRiskEvent({
      userId: session.user.id,
      type: "missing_risk_acknowledgement_attempt",
      severity: "medium",
      meta: { sourceType: car.sourceType, carId: car.id },
    });
    return NextResponse.json({ error: "Risk acknowledgement is required." }, { status: 400 });
  }

  const settings = await getGlobalCurrencySettings();
  const amount = getVehicleCheckoutAmountGhs(Number(car.basePriceRmb), parsed.data.paymentType, settings);

  const reference = `SDA-${nanoid(12).toUpperCase()}`;
  const selectedProvider = await getDefaultPaymentProvider();
  if (selectedProvider !== "PAYSTACK") {
    return NextResponse.json({ error: "Configured default provider is not supported for this checkout yet." }, { status: 409 });
  }

  const { secretKey } = await getPaystackSecrets();
  if (!secretKey) {
    return NextResponse.json(
      {
        error:
          "Paystack is not configured. Add a secret key under Admin → API providers (or set PAYSTACK_SECRET_KEY).",
      },
      { status: 500 },
    );
  }
  const callbackOrigin = await getPaystackCallbackOrigin();
  const callbackUrl = `${callbackOrigin}/checkout/return?reference=${encodeURIComponent(reference)}`;

  const order = await prisma.order.create({
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

  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      userId: session.user.id,
      provider: "PAYSTACK",
      settlementMethod: "PAYSTACK",
      providerReference: reference,
      amount,
      currency: car.currency,
      status: "PENDING",
      paymentType: parsed.data.paymentType,
      idempotencyKey: reference,
    },
  });

  const init = await paystackInitialize({
    email,
    amountMinorUnits: Math.round(amount * 100),
    reference,
    currency: car.currency,
    metadata: {
      orderId: order.id,
      paymentId: payment.id,
      carId: car.id,
    },
    callbackUrl,
    secretKey,
  });

  const activeContract = requiresSourcingContract(car.sourceType)
    ? await prisma.contract.findFirst({
        where: { type: "CAR_SOURCING", isActive: true },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      })
    : null;
  await prisma.$transaction(async (tx) => {
    await tx.agreementLog.create({
      data: {
        userId: session.user.id,
        orderId: order.id,
        agreementVersion: parsed.data.agreementVersion,
        policyIds: [parsed.data.agreementVersion],
        accepted: true,
      },
    });
    if (requiresSourcingContract(car.sourceType) && parsed.data.contractAccepted && parsed.data.contractVersion) {
      await tx.contractAcceptance.create({
        data: {
          userId: session.user.id,
          orderId: order.id,
          contractId: activeContract?.id ?? null,
          contractVersion: parsed.data.contractVersion,
          context: "CAR_SOURCING",
        },
      });
    }
    if (requiresRiskAcknowledgement(car.sourceType) && parsed.data.riskAccepted && parsed.data.riskVersion) {
      await tx.riskAcknowledgement.create({
        data: {
          userId: session.user.id,
          orderId: order.id,
          acknowledgementVersion: parsed.data.riskVersion,
          context: car.sourceType,
        },
      });
    }
  });

  return NextResponse.json({
    authorizationUrl: init.authorization_url,
    reference: init.reference,
  });
}
