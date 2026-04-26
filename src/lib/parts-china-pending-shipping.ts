import { DeliveryMode, NotificationType, PaymentType, type Prisma } from "@prisma/client";
import { nanoid } from "nanoid";

import { getPaystackCallbackOrigin, getPaystackSecrets } from "@/lib/payment-provider-registry";
import { paystackInitialize, paystackVerify } from "@/lib/paystack";
import { prisma } from "@/lib/prisma";
import { computeChinaShippingForDeliveryMode } from "@/lib/shipping/parts-china-fees";
import { applyWalletLedgerEntry } from "@/lib/wallet-ledger";

const PART_SELECT = { id: true, origin: true, stockStatus: true } as const;

export type PendingChinaContext = {
  orderId: string;
  orderReference: string;
  shipmentId: string;
  preOrderPartIds: string[];
};

/**
 * Shipment is PARTS_CHINA with `deferredChinaShipping` and unpaid intl leg
 * (China + ON_REQUEST parts on the order).
 */
export async function getDeferredChinaContextForUser(
  orderId: string,
  userId: string,
): Promise<PendingChinaContext | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId, kind: "PARTS" },
    select: { id: true, reference: true },
  });
  if (!order) return null;
  const s = await prisma.shipment.findFirst({
    where: {
      orderId,
      kind: "PARTS_CHINA",
      deferredChinaShipping: true,
    },
  });
  if (!s) return null;
  const preOrderPartIds: string[] = [];
  const items = await prisma.partOrderItem.findMany({ where: { orderId } });
  for (const row of items) {
    if (!row.partId) continue;
    const p = await prisma.part.findUnique({ where: { id: row.partId }, select: PART_SELECT });
    if (p?.origin === "CHINA" && p.stockStatus === "ON_REQUEST") {
      preOrderPartIds.push(p.id);
    }
  }
  if (preOrderPartIds.length === 0) return null;
  return { orderId: order.id, orderReference: order.reference, shipmentId: s.id, preOrderPartIds };
}

async function settleShipmentInTx(
  tx: Prisma.TransactionClient,
  args: { shipmentId: string; orderId: string; deliveryMode: DeliveryMode; feeGhs: number; eta: string; userId: string },
) {
  await tx.shipment.update({
    where: { id: args.shipmentId },
    data: {
      deferredChinaShipping: false,
      deliveryMode: args.deliveryMode,
      feeAmount: args.feeGhs,
      feeCurrency: "GHS",
      estimatedDuration: args.eta,
      currentStage: "PROCESSING",
    },
  });
  await tx.shipmentStatusEvent.create({
    data: {
      shipmentId: args.shipmentId,
      stage: "PROCESSING",
      title: "International shipping paid",
      description: `GHS ${args.feeGhs.toFixed(2)} paid for ${args.deliveryMode.replaceAll("_", " ")}. Operations will book freight to your address.`,
      visibleToCustomer: true,
    },
  });
  await tx.notification.create({
    data: {
      userId: args.userId,
      type: NotificationType.SHIPPING,
      title: "Pre-order (China) — shipping selected",
      body: "Your international leg is confirmed. Track updates under Shipping & delivery.",
      href: "/dashboard/shipping",
    },
  });
}

export async function payDeferredChinaFromWallet(
  userId: string,
  orderId: string,
  mode: DeliveryMode,
): Promise<{ ok: true }> {
  const ctx = await getDeferredChinaContextForUser(orderId, userId);
  if (!ctx) throw new Error("No pending China pre-order shipping for this order.");

  const { feeGhs, etaSummary } = await computeChinaShippingForDeliveryMode(ctx.preOrderPartIds, mode);
  if (feeGhs <= 0) {
    throw new Error("This shipping option is not configured yet. Ask admin to apply international delivery on the part.");
  }

  const u = await prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true } });
  if (!u || Number(u.walletBalance) < feeGhs) {
    throw new Error("Insufficient wallet balance for this shipping option.");
  }

  const payRef = `SDA-PCN-INTL-${ctx.orderReference}-${nanoid(6).toUpperCase()}`;

  await prisma.$transaction(async (tx) => {
    await applyWalletLedgerEntry(
      {
        userId,
        reference: payRef,
        amount: feeGhs,
        currency: "GHS",
        direction: "DEBIT",
        purpose: "PARTS_PURCHASE",
        orderId: ctx.orderId,
        paidAt: new Date(),
        actorUserId: userId,
        providerPayload: { kind: "parts_china_preorder_intl", mode } as object,
      },
      tx,
    );
    await settleShipmentInTx(
      tx,
      {
        shipmentId: ctx.shipmentId,
        orderId: ctx.orderId,
        deliveryMode: mode,
        feeGhs,
        eta: etaSummary,
        userId,
      },
    );
  });
  return { ok: true };
}

export async function createDeferredChinaPaystackSession(
  userId: string,
  email: string,
  orderId: string,
  mode: DeliveryMode,
): Promise<{ authorizationUrl: string; reference: string; amount: number }> {
  const ctx = await getDeferredChinaContextForUser(orderId, userId);
  if (!ctx) throw new Error("No pending China pre-order shipping for this order.");
  const { feeGhs, etaSummary } = await computeChinaShippingForDeliveryMode(ctx.preOrderPartIds, mode);
  if (feeGhs <= 0) {
    throw new Error("This shipping option is not configured yet. Ask admin to set international options on the part.");
  }
  const { secretKey } = await getPaystackSecrets();
  if (!secretKey) throw new Error("Paystack is not configured.");
  const callbackOrigin = await getPaystackCallbackOrigin();
  const ref = `SDA-PCF-${nanoid(12).toUpperCase()}`;

  await prisma.payment.create({
    data: {
      orderId: ctx.orderId,
      userId,
      amount: feeGhs,
      currency: "GHS",
      status: "PENDING",
      paymentType: PaymentType.FREIGHT,
      provider: "PAYSTACK",
      settlementMethod: "PAYSTACK",
      methodDetails: {
        kind: "parts_china_preorder_intl",
        shipmentId: ctx.shipmentId,
        deliveryMode: mode,
        eta: etaSummary,
      } as Prisma.InputJsonValue,
      providerReference: ref,
    },
  });

  const init = await paystackInitialize({
    email,
    amountMinorUnits: Math.round(feeGhs * 100),
    reference: ref,
    currency: "GHS",
    callbackUrl: `${callbackOrigin}/dashboard/orders/${orderId}?chinaFreightRef=${encodeURIComponent(ref)}`,
    metadata: { kind: "parts_china_preorder_intl", userId, orderId: ctx.orderId, shipmentId: ctx.shipmentId, mode },
    secretKey,
  });
  return { authorizationUrl: init.authorization_url, reference: ref, amount: feeGhs };
}

export async function verifyDeferredChinaPaystack(
  userId: string,
  orderId: string,
  reference: string,
): Promise<{ ok: true; alreadySettled?: boolean }> {
  const p = await prisma.payment.findFirst({
    where: { userId, orderId, providerReference: reference },
  });
  if (!p) throw new Error("Payment not found.");
  if (p.status === "SUCCESS") {
    return { ok: true, alreadySettled: true };
  }
  if (p.status !== "PENDING") {
    throw new Error("This payment is not pending.");
  }

  const { secretKey } = await getPaystackSecrets();
  if (!secretKey) throw new Error("Paystack is not configured.");
  const v = await paystackVerify(reference, secretKey);
  if (v.status !== "success") {
    throw new Error("Payment is not complete yet. Try again when Paystack confirms success.");
  }
  if (Math.round(Number(p.amount) * 100) !== v.amount) {
    throw new Error("Amount verification mismatch.");
  }

  const det = p.methodDetails as { shipmentId?: string; deliveryMode?: DeliveryMode } | null;
  if (!det?.shipmentId || !det.deliveryMode) {
    throw new Error("Invalid payment details.");
  }
  const mode = det.deliveryMode;
  const existingShip = await prisma.shipment.findFirst({ where: { id: det.shipmentId, orderId } });
  if (existingShip && !existingShip.deferredChinaShipping) {
    await prisma.payment.update({ where: { id: p.id }, data: { status: "SUCCESS", paidAt: new Date() } });
    return { ok: true, alreadySettled: true };
  }

  const ctx = await getDeferredChinaContextForUser(orderId, userId);
  const pids = ctx?.preOrderPartIds ?? [];
  const { etaSummary } = await computeChinaShippingForDeliveryMode(pids, mode);

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: p.id }, data: { status: "SUCCESS", paidAt: new Date() } });
    await settleShipmentInTx(
      tx,
      {
        shipmentId: det.shipmentId!,
        orderId,
        deliveryMode: mode,
        feeGhs: Number(p.amount),
        eta: etaSummary,
        userId,
      },
    );
  });
  return { ok: true };
}
