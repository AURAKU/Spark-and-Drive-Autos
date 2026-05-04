import { OrderKind, PaymentType, Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getDefaultPaymentProvider,
  getPaystackCallbackOrigin,
  getPaystackSecrets,
} from "@/lib/payment-provider-registry";
import { customerCheckoutBlockedMessage, getCarCheckoutIneligibleReason } from "@/lib/checkout-eligibility";
import { isCheckoutConflictError, throwCheckoutConflict } from "@/lib/checkout-transaction-errors";
import { depositAmountGhsFromFull } from "@/lib/checkout-amount";
import { getGlobalCurrencySettings } from "@/lib/currency";
import { assertProfileLegalCompleteOrResponse } from "@/lib/legal-compliance-central";
import { writeLegalAuditLog } from "@/lib/legal-audit";
import { ACCEPTANCE_CONTEXT, recordUserContractAcceptance, recordUserPolicyAcceptance } from "@/lib/legal-acceptance";
import {
  assertVehicleCheckoutLegalVersions,
  getActiveRiskPolicyRow,
  getActiveSourcingContractRow,
  POLICY_KEYS,
  requiresRiskAcknowledgement,
  requiresSourcingContract,
} from "@/lib/legal-enforcement";
import { getUserRiskTags } from "@/lib/legal-risk-controls";
import { hasAcceptedContract } from "@/lib/legal-backend-helpers";
import { logRiskEvent } from "@/lib/risk-engine";
import { safeAuth } from "@/lib/safe-auth";
import { paystackInitialize } from "@/lib/paystack";
import { prisma } from "@/lib/prisma";
import { getRequestIp } from "@/lib/client-ip";
import { rateLimitPayment } from "@/lib/rate-limit";
import { recordSecurityObservation } from "@/lib/security-observation";
import { carHasSuccessfulFullVehiclePayment } from "@/lib/sold-vehicle";
import {
  computeDepositCheckoutSnapshot,
  resolveOrderStorageAnchors,
  resolveVehicleListPriceGhs,
} from "@/lib/vehicle-deposit-pricing";
import { requireVerification } from "@/lib/identity-verification";

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
  const legalBlock = await assertProfileLegalCompleteOrResponse(session.user.id);
  if (legalBlock) return legalBlock;
  const risk = await getUserRiskTags(session.user.id);
  if (risk.includes("FRAUD_RISK_REVIEW") || risk.includes("MANUAL_REVIEW_REQUIRED")) {
    await logRiskEvent({
      userId: session.user.id,
      type: "blocked_checkout_manual_review_required",
      severity: "high",
      meta: { route: "/api/payments/initialize" },
    });
    return NextResponse.json(
      { error: "Your account is under manual review. Contact support to continue payment.", code: "MANUAL_REVIEW_REQUIRED" },
      { status: 423 },
    );
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
  if (await carHasSuccessfulFullVehiclePayment(car.id)) {
    return NextResponse.json(
      { error: customerCheckoutBlockedMessage("VEHICLE_SOLD"), code: "VEHICLE_SOLD" },
      { status: 409 },
    );
  }
  if (requiresSourcingContract(car.sourceType)) {
    const acceptedContract = await hasAcceptedContract(session.user.id, "VEHICLE_PARTS_SOURCING_CONTRACT");
    if (!acceptedContract) {
      await logRiskEvent({
        userId: session.user.id,
        type: "missing_contract_acceptance_attempt",
        severity: "medium",
        meta: { sourceType: car.sourceType, carId: car.id },
      });
      return NextResponse.json(
        { error: "Accept pending legal updates in your profile before payment.", code: "REQUIRE_ACCEPTANCE" },
        { status: 409 },
      );
    }
  }
  const legalOk = await assertVehicleCheckoutLegalVersions({
    agreementVersion: parsed.data.agreementVersion,
    contractVersion: parsed.data.contractVersion,
    riskVersion: parsed.data.riskVersion,
    sourceType: car.sourceType,
  });
  if (!legalOk.ok) {
    return NextResponse.json(
      {
        error: "Terms on this page are out of date. Refresh checkout and accept the latest agreements.",
        code: legalOk.code,
      },
      { status: 409 },
    );
  }

  const settings = await getGlobalCurrencySettings();
  const depositPctStored =
    car.reservationDepositPercent != null ? Number(car.reservationDepositPercent) : null;
  /** Single list-price resolution (GHS + currencyBase + FX) for both deposit and full pay — matches deposit math. */
  const listResolution = resolveVehicleListPriceGhs(car, settings);
  const previewAmount =
    parsed.data.paymentType === PaymentType.RESERVATION_DEPOSIT
      ? depositAmountGhsFromFull(listResolution.fullListGhs, depositPctStored)
      : Math.round(Math.max(0, listResolution.fullListGhs) * 100) / 100;
  try {
    await requireVerification({
      userId: session.user.id,
      context: "VEHICLE_PURCHASE",
      amountGhs: previewAmount,
      ipAddress: ip,
      userAgent,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "IDENTITY_VERIFICATION_REQUIRED") {
      return NextResponse.json(
        {
          error:
            "Identity verification is required before this payment can continue. Visit Dashboard → Verification to submit your Ghana Card or valid ID.",
          code: "IDENTITY_VERIFICATION_REQUIRED",
        },
        { status: 409 },
      );
    }
    throw error;
  }

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

  let order: { id: string; currency: string };
  let payment: { id: string };
  let amount: number;
  try {
    const created = await prisma.$transaction(
      async (tx) => {
        const carFresh = await tx.car.findUnique({ where: { id: parsed.data.carId } });
        if (!carFresh) throwCheckoutConflict("CAR_NOT_FOUND");
        const block = getCarCheckoutIneligibleReason(carFresh);
        if (block) throwCheckoutConflict("INELIGIBLE", block);
        const paidRows = await tx.payment.findMany({
          where: {
            status: "SUCCESS",
            order: { carId: carFresh.id, kind: OrderKind.CAR },
          },
          select: { paymentType: true },
        });
        const hasFullPaid = paidRows.some((p) => p.paymentType === PaymentType.FULL);
        const hasDepositPaid = paidRows.some((p) => p.paymentType === PaymentType.RESERVATION_DEPOSIT);
        if (hasFullPaid) throwCheckoutConflict("ALREADY_PURCHASED");
        if (parsed.data.paymentType === PaymentType.RESERVATION_DEPOSIT && hasDepositPaid) {
          throwCheckoutConflict("DEPOSIT_ALREADY_PAID");
        }
        if (parsed.data.paymentType === PaymentType.FULL && hasDepositPaid) {
          throwCheckoutConflict("BALANCE_PAYMENT_ONLINE_UNAVAILABLE");
        }
        const depPct =
          carFresh.reservationDepositPercent != null ? Number(carFresh.reservationDepositPercent) : null;
        let amountTx: number;
        const baseOrderData = {
          reference,
          userId: session.user.id,
          carId: carFresh.id,
          kind: OrderKind.CAR,
          orderStatus: "PENDING_PAYMENT" as const,
          paymentType: parsed.data.paymentType,
        };
        if (parsed.data.paymentType === PaymentType.RESERVATION_DEPOSIT) {
          const snap = computeDepositCheckoutSnapshot(carFresh, settings, depPct);
          const anchors = resolveOrderStorageAnchors(carFresh, snap.resolution);
          amountTx = snap.depositGhs;
          const ord = await tx.order.create({
            data: {
              ...baseOrderData,
              currency: "GHS",
              amount: amountTx,
              depositAmount: snap.depositGhs,
              remainingBalance: snap.remainingBalance,
              orderDepositPercentSnapshot: snap.depositPercentApplied,
              currencyBase: snap.resolution.currencyBase,
              exchangeRateUsed: snap.resolution.exchangeRateUsed,
              vehicleListPriceGhs: anchors.vehicleListPriceGhs,
              baseAmount: anchors.baseAmount ?? undefined,
              reservedAt: new Date(),
            },
          });
          const pay = await tx.payment.create({
            data: {
              orderId: ord.id,
              userId: session.user.id,
              provider: "PAYSTACK",
              settlementMethod: "PAYSTACK",
              providerReference: reference,
              amount: amountTx,
              currency: "GHS",
              status: "PENDING",
              paymentType: parsed.data.paymentType,
              idempotencyKey: reference,
            },
          });
          return { order: ord, payment: pay, amount: amountTx };
        }
        const fullResolution = resolveVehicleListPriceGhs(carFresh, settings);
        const anchorsFull = resolveOrderStorageAnchors(carFresh, fullResolution);
        amountTx = Math.round(Math.max(0, fullResolution.fullListGhs) * 100) / 100;
        const ord = await tx.order.create({
          data: {
            ...baseOrderData,
            currency: "GHS",
            amount: amountTx,
            currencyBase: fullResolution.currencyBase,
            exchangeRateUsed: fullResolution.exchangeRateUsed ?? undefined,
            vehicleListPriceGhs: anchorsFull.vehicleListPriceGhs,
            baseAmount: anchorsFull.baseAmount ?? undefined,
          },
        });
        const pay = await tx.payment.create({
          data: {
            orderId: ord.id,
            userId: session.user.id,
            provider: "PAYSTACK",
            settlementMethod: "PAYSTACK",
            providerReference: reference,
            amount: amountTx,
            currency: "GHS",
            status: "PENDING",
            paymentType: parsed.data.paymentType,
            idempotencyKey: reference,
          },
        });
        return { order: ord, payment: pay, amount: amountTx };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 20_000,
      },
    );
    order = created.order;
    payment = created.payment;
    amount = created.amount;
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") {
      return NextResponse.json(
        { error: "Checkout is busy for this vehicle. Please try again in a moment.", code: "SERIALIZATION_RETRY" },
        { status: 409 },
      );
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
      if (e.checkoutCode === "DEPOSIT_ALREADY_PAID") {
        return NextResponse.json(
          {
            error:
              "A reservation deposit for this vehicle is already on file. Open your orders or contact support to complete the remaining balance.",
            code: "DEPOSIT_ALREADY_PAID",
          },
          { status: 409 },
        );
      }
      if (e.checkoutCode === "BALANCE_PAYMENT_ONLINE_UNAVAILABLE") {
        return NextResponse.json(
          {
            error:
              "This vehicle has an active reservation deposit. Complete the remaining balance with our team — online full payment cannot replace that flow yet.",
            code: "BALANCE_PAYMENT_ONLINE_UNAVAILABLE",
          },
          { status: 409 },
        );
      }
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to start payment", code: "SERVER_ERROR" },
      { status: 500 },
    );
  }

  let init: { authorization_url: string; reference: string };
  try {
    init = await paystackInitialize({
      email,
      amountMinorUnits: Math.round(amount * 100),
      reference,
      currency: "GHS",
      metadata: {
        orderId: order.id,
        paymentId: payment.id,
        carId: parsed.data.carId,
      },
      callbackUrl,
      secretKey,
    });
  } catch (e) {
    console.error("[payments/initialize] paystack", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Could not open Paystack. Check configuration or try again in a moment.",
        code: "PAYSTACK_ERROR",
      },
      { status: 502 },
    );
  }

  const checkoutPv = await prisma.policyVersion.findFirst({
    where: { policyKey: POLICY_KEYS.CHECKOUT_AGREEMENT, isActive: true },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
  });
  const riskPv =
    requiresRiskAcknowledgement(car.sourceType) && parsed.data.riskAccepted ? await getActiveRiskPolicyRow() : null;
  const activeContractRow = requiresSourcingContract(car.sourceType) ? await getActiveSourcingContractRow() : null;

  const checkoutSnap =
    checkoutPv?.title || checkoutPv?.content
      ? `${checkoutPv.title ?? ""}\n\nVersion ${checkoutPv.version}\n\n${checkoutPv.content ?? ""}`.trim()
      : null;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.agreementLog.create({
        data: {
          userId: session.user.id,
          orderId: order.id,
          agreementVersion: parsed.data.agreementVersion,
          policyIds: [parsed.data.agreementVersion],
          accepted: true,
          ipAddress: ip,
          userAgent,
          acceptanceTextSnapshot: checkoutSnap,
        },
      });
      if (checkoutPv) {
        await recordUserPolicyAcceptance({
          userId: session.user.id,
          policyVersionId: checkoutPv.id,
          context: ACCEPTANCE_CONTEXT.CHECKOUT,
          ipAddress: ip,
          userAgent,
          tx,
        });
      }
      if (riskPv && parsed.data.riskVersion) {
        await recordUserPolicyAcceptance({
          userId: session.user.id,
          policyVersionId: riskPv.id,
          context: ACCEPTANCE_CONTEXT.CHECKOUT,
          ipAddress: ip,
          userAgent,
          tx,
        });
      }
      if (requiresSourcingContract(car.sourceType) && parsed.data.contractAccepted && parsed.data.contractVersion) {
        await recordUserContractAcceptance({
          userId: session.user.id,
          contractId: activeContractRow?.id ?? null,
          orderId: order.id,
          contractVersion: parsed.data.contractVersion,
          context: "CAR_SOURCING",
          ipAddress: ip,
          userAgent,
          tx,
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
    await writeLegalAuditLog({
      actorId: session.user.id,
      targetUserId: session.user.id,
      action: "USER_ACCEPTED_CHECKOUT_LEGAL",
      entityType: "Order",
      entityId: order.id,
      metadata: {
        agreementVersion: parsed.data.agreementVersion,
        contractVersion: parsed.data.contractVersion ?? null,
        riskVersion: parsed.data.riskVersion ?? null,
      },
      ipAddress: ip,
      userAgent,
    });
  } catch (e) {
    console.error("[payments/initialize] agreement persistence", e);
    return NextResponse.json(
      {
        error: "We could not save your agreement acceptances. Please try again or contact support.",
        code: "AGREEMENT_PERSIST_ERROR",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    authorizationUrl: init.authorization_url,
    reference: init.reference,
  });
}
