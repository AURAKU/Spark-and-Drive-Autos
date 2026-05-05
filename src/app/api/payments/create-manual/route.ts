import { NotificationType, OrderKind, PaymentType, Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { z } from "zod";

import { globalReservationDepositPercentFromSettings } from "@/lib/checkout-amount";
import {
  customerCheckoutBlockedMessage,
  getCarCheckoutIneligibleReason,
  isVehicleListingMarkedSold,
} from "@/lib/checkout-eligibility";
import { isCheckoutConflictError, throwCheckoutConflict } from "@/lib/checkout-transaction-errors";
import { getGlobalCurrencySettings } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { getRequestIp } from "@/lib/client-ip";
import { rateLimitPayment } from "@/lib/rate-limit";
import { safeAuth } from "@/lib/safe-auth";
import { recordSecurityObservation } from "@/lib/security-observation";
import {
  computeDepositCheckoutSnapshot,
  resolveOrderStorageAnchors,
  getVehicleSettlementAmountGhs,
} from "@/lib/vehicle-deposit-pricing";
import { assertProfileLegalCompleteOrResponse } from "@/lib/legal-compliance-central";
import { writeLegalAuditLog } from "@/lib/legal-audit";
import { requireVerification } from "@/lib/identity-verification";

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

export const runtime = "nodejs";

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
  const legalBlock = await assertProfileLegalCompleteOrResponse(session.user.id);
  if (legalBlock) return legalBlock;

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

  const car = await prisma.car.findUnique({
    where: { id: parsed.data.carId },
    select: {
      id: true,
      title: true,
      slug: true,
      basePriceRmb: true,
      basePriceAmount: true,
      basePriceCurrency: true,
      priceGhs: true,
      priceUsd: true,
      priceCny: true,
      currency: true,
      listingState: true,
      availabilityStatus: true,
      sourceType: true,
      reservationDepositPercent: true,
    },
  });
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
  const depPct = car.reservationDepositPercent != null ? Number(car.reservationDepositPercent) : null;
  const settlementPreview = getVehicleSettlementAmountGhs(car, parsed.data.paymentType, settings, depPct);
  if (!settlementPreview || settlementPreview.settlementGhs <= 0) {
    return NextResponse.json(
      { error: "This vehicle does not have a valid list price for manual checkout.", code: "INVALID_VEHICLE_PRICE" },
      { status: 409 },
    );
  }
  const previewAmount = settlementPreview.settlementGhs;
  try {
    await requireVerification({
      userId: session.user.id,
      context: "MANUAL_PAYMENT",
      amountGhs: previewAmount,
      ipAddress: ip,
      userAgent,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "IDENTITY_VERIFICATION_REQUIRED") {
      return NextResponse.json(
        {
          error:
            "Identity verification is required before manual payment flows can continue. Submit verification in Dashboard → Verification.",
          code: "IDENTITY_VERIFICATION_REQUIRED",
        },
        { status: 409 },
      );
    }
    throw error;
  }
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
        const paidRows = await tx.payment.findMany({
          where: {
            status: "SUCCESS",
            order: { carId: carFresh.id, kind: OrderKind.CAR },
          },
          select: { paymentType: true },
        });
        const hasFullPaid = paidRows.some((p) => p.paymentType === PaymentType.FULL);
        const hasDepositPaid = paidRows.some((p) => p.paymentType === PaymentType.RESERVATION_DEPOSIT);
        if (hasFullPaid && isVehicleListingMarkedSold(carFresh)) throwCheckoutConflict("ALREADY_PURCHASED");
        if (parsed.data.paymentType === PaymentType.RESERVATION_DEPOSIT && hasDepositPaid) {
          throwCheckoutConflict("DEPOSIT_ALREADY_PAID");
        }
        if (parsed.data.paymentType === PaymentType.FULL && hasDepositPaid) {
          throwCheckoutConflict("BALANCE_PAYMENT_ONLINE_UNAVAILABLE");
        }
        const dPct =
          carFresh.reservationDepositPercent != null ? Number(carFresh.reservationDepositPercent) : null;
        const globalDepositPct = globalReservationDepositPercentFromSettings(settings);
        const settlement = getVehicleSettlementAmountGhs(carFresh, parsed.data.paymentType, settings, dPct);
        if (!settlement || settlement.settlementGhs <= 0) throwCheckoutConflict("INVALID_DEPOSIT_AMOUNT");
        const amountTx = settlement.settlementGhs;

        const baseOrderData = {
          reference,
          userId: session.user.id,
          carId: carFresh.id,
          kind: OrderKind.CAR,
          orderStatus: "PENDING_PAYMENT" as const,
          paymentType: parsed.data.paymentType,
          currency: "GHS" as const,
          amount: amountTx,
        };

        let order;
        if (parsed.data.paymentType === PaymentType.RESERVATION_DEPOSIT) {
          const snap = computeDepositCheckoutSnapshot(carFresh, settings, dPct, globalDepositPct);
          if (!snap || snap.depositGhs <= 0) throwCheckoutConflict("INVALID_DEPOSIT_AMOUNT");
          const anchors = resolveOrderStorageAnchors(carFresh, snap.resolution);
          order = await tx.order.create({
            data: {
              ...baseOrderData,
              depositAmount: snap.depositGhs,
              remainingBalance: snap.remainingBalance,
              orderDepositPercentSnapshot: snap.depositPercentApplied,
              currencyBase: snap.resolution.currencyBase,
              exchangeRateUsed: snap.resolution.exchangeRateUsed ?? undefined,
              vehicleListPriceGhs: anchors.vehicleListPriceGhs,
              baseAmount: anchors.baseAmount ?? undefined,
              reservedAt: new Date(),
            },
          });
        } else {
          const anchorsFull = resolveOrderStorageAnchors(carFresh, settlement.resolution);
          order = await tx.order.create({
            data: {
              ...baseOrderData,
              currencyBase: settlement.resolution.currencyBase,
              exchangeRateUsed: settlement.resolution.exchangeRateUsed ?? undefined,
              vehicleListPriceGhs: anchorsFull.vehicleListPriceGhs,
              baseAmount: anchorsFull.baseAmount ?? undefined,
            },
          });
        }

        const pay = await tx.payment.create({
          data: {
            orderId: order.id,
            userId: session.user.id,
            provider: "MANUAL",
            settlementMethod,
            providerReference: reference,
            amount: amountTx,
            currency: "GHS",
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
      if (e.checkoutCode === "DEPOSIT_ALREADY_PAID") {
        return NextResponse.json(
          {
            error:
              "A reservation deposit for this vehicle is already on file. Complete the remaining balance with our team.",
            code: "DEPOSIT_ALREADY_PAID",
          },
          { status: 409 },
        );
      }
      if (e.checkoutCode === "BALANCE_PAYMENT_ONLINE_UNAVAILABLE") {
        return NextResponse.json(
          {
            error:
              "This vehicle has an active reservation deposit. Complete the remaining balance with our team before paying in full online or offline.",
            code: "BALANCE_PAYMENT_ONLINE_UNAVAILABLE",
          },
          { status: 409 },
        );
      }
      if (e.checkoutCode === "INVALID_DEPOSIT_AMOUNT") {
        return NextResponse.json(
          {
            error: "Could not compute deposit for this vehicle. Check list price and deposit percentage settings.",
            code: "INVALID_DEPOSIT_AMOUNT",
          },
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
  await writeLegalAuditLog({
    actorId: session.user.id,
    targetUserId: session.user.id,
    action: "MANUAL_PAYMENT_CREATED",
    entityType: "Payment",
    entityId: payment.id,
    ipAddress: ip,
    userAgent,
    metadata: { settlementMethod },
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
