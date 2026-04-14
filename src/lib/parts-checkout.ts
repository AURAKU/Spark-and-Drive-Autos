import { nanoid } from "nanoid";
import { DeliveryMode, NotificationType, Prisma } from "@prisma/client";

import { getGlobalCurrencySettings } from "@/lib/currency";
import {
  partOutOfStockCustomerMessage,
  partQuantityExceedsStockMessage,
  PartsStockError,
} from "@/lib/parts-stock-customer";
import { getPartDisplayPrice } from "@/lib/parts-pricing";
import { prisma } from "@/lib/prisma";
import { createReceiptReference, generateAndPersistOrderReceiptPdf, makePartsReceiptLines } from "@/lib/receipt-engine";
import { maybeNotifyAdminsGhanaLowStock } from "@/lib/ghana-low-stock";
import { computeChinaShippingQuote, type ChinaShippingChoice } from "@/lib/shipping/parts-china-fees";
import { createShipmentsForPaidPartsOrder } from "@/lib/shipping/shipment-service";
import { applyWalletLedgerEntry } from "@/lib/wallet-ledger";

type CheckoutItem = {
  partId: string;
  quantity: number;
};

function buildReceipt(params: {
  reference: string;
  items: Array<{ title: string; quantity: number; unitPrice: number; total: number }>;
  total: number;
}) {
  return {
    reference: params.reference,
    logoUrl: "/brand/logo-emblem.png",
    companyName: "Spark and Drive Autos",
    companyPhone: "+233 54 000 0000",
    companyEmail: "support@sparkanddriveautos.com",
    storeLocation: "Accra, Ghana",
    items: params.items,
    total: params.total,
    currency: "GHS",
    thankYou: "Thank you for shopping with us.",
    issuedAt: new Date().toISOString(),
  };
}

export async function createPartsWalletOrder(input: {
  userId: string;
  addressId: string;
  items: CheckoutItem[];
  clearFromCart?: boolean;
  requestKey?: string;
  agreementVersion: string;
  /** Required when the cart includes any China-origin parts (Air vs Sea). */
  chinaShippingChoice?: ChinaShippingChoice;
}): Promise<{ orderId: string; reference: string }> {
  if (input.items.length === 0) throw new Error("Select at least one item.");
  const idempotencyRef =
    input.requestKey && input.requestKey.trim().length > 0 ? `SDA-PART-${input.requestKey.trim()}` : null;
  if (idempotencyRef) {
    const existing = await prisma.walletTransaction.findUnique({
      where: { reference: idempotencyRef },
      select: { orderId: true, order: { select: { reference: true } } },
    });
    if (existing?.orderId) {
      return { orderId: existing.orderId, reference: existing.order?.reference ?? idempotencyRef };
    }
  }
  const fx = await getGlobalCurrencySettings();

  const [user, address, dbParts] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, name: true, walletBalance: true } }),
    prisma.userAddress.findFirst({
      where: { id: input.addressId, userId: input.userId },
      select: {
        id: true,
        fullName: true,
        phone: true,
        region: true,
        city: true,
        streetAddress: true,
        digitalAddress: true,
      },
    }),
    prisma.part.findMany({
      where: { id: { in: input.items.map((i) => i.partId) }, listingState: "PUBLISHED" },
      select: { id: true, title: true, stockQty: true, origin: true, basePriceRmb: true, priceGhs: true, coverImageUrl: true },
    }),
  ]);

  if (!user) throw new Error("User not found.");
  if (!address) throw new Error("Delivery address is required.");

  const partMap = new Map(dbParts.map((p) => [p.id, p]));
  const normalizedItems = input.items.map((item) => {
    const part = partMap.get(item.partId);
    if (!part) throw new Error("Some selected items are unavailable.");
    if (item.quantity < 1) throw new Error("Invalid item quantity.");
    if (part.stockQty < 1) {
      throw new PartsStockError(
        partOutOfStockCustomerMessage(part.title),
        "OUT_OF_STOCK",
        part.title,
        0,
        item.quantity,
      );
    }
    if (part.stockQty < item.quantity) {
      throw new PartsStockError(
        partQuantityExceedsStockMessage(part.title, item.quantity, part.stockQty),
        "INSUFFICIENT_STOCK",
        part.title,
        part.stockQty,
        item.quantity,
      );
    }
    const unitPrice = getPartDisplayPrice(
      { origin: part.origin, basePriceRmb: Number(part.basePriceRmb), priceGhs: Number(part.priceGhs) },
      "GHS",
      fx,
    ).amount;
    const lineTotal = unitPrice * item.quantity;
    return { part, quantity: item.quantity, unitPrice, lineTotal };
  });

  const partsSubtotal = normalizedItems.reduce((sum, i) => sum + i.lineTotal, 0);
  const chinaPartIds = [...new Set(normalizedItems.filter((i) => i.part.origin === "CHINA").map((i) => i.part.id))];
  let chinaFeeGhs = 0;
  let chinaEta = "";
  let chinaDeliveryMode: DeliveryMode | undefined;
  let chinaChoice: ChinaShippingChoice | undefined;
  if (chinaPartIds.length > 0) {
    if (!input.chinaShippingChoice) throw new Error("Select Air or Sea shipping for China-origin parts.");
    const quote = await computeChinaShippingQuote(chinaPartIds, input.chinaShippingChoice);
    chinaFeeGhs = quote.feeGhs;
    chinaEta = quote.etaSummary;
    chinaDeliveryMode = quote.deliveryMode;
    chinaChoice = input.chinaShippingChoice;
  }
  const total = partsSubtotal + chinaFeeGhs;
  if (Number(user.walletBalance) < total) throw new Error("Insufficient wallet balance.");

  const reference = `SDA-PART-${nanoid(10).toUpperCase()}`;
  const receiptReference = createReceiptReference();
  const receiptLineItems = normalizedItems.map((i) => ({
    title: i.part.title,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    total: i.lineTotal,
  }));
  if (chinaFeeGhs > 0 && chinaChoice) {
    receiptLineItems.push({
      title: `International shipping (${chinaChoice === "SEA" ? "Sea" : "Air"})`,
      quantity: 1,
      unitPrice: chinaFeeGhs,
      total: chinaFeeGhs,
    });
  }
  const receipt = buildReceipt({
    reference,
    total,
    items: receiptLineItems,
  });

  const addressSnapshot: Prisma.InputJsonValue = {
    fullName: address.fullName,
    phone: address.phone,
    region: address.region,
    city: address.city,
    streetAddress: address.streetAddress,
    digitalAddress: address.digitalAddress,
  };

  let result: { id: string; reference: string };
  try {
    result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        reference,
        kind: "PARTS",
        userId: input.userId,
        orderStatus: "PAID",
        paymentType: "FULL",
        amount: total,
        currency: "GHS",
        deliveryAddressId: address.id,
        deliveryAddressSnapshot: addressSnapshot,
        receiptData: receipt as Prisma.InputJsonValue,
        receiptReference,
      },
      select: { id: true, reference: true },
    });

    await tx.partOrderItem.createMany({
      data: normalizedItems.map((i) => ({
        orderId: order.id,
        partId: i.part.id,
        titleSnapshot: i.part.title,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: i.lineTotal,
        currency: "GHS",
        coverImageUrl: i.part.coverImageUrl,
        origin: i.part.origin,
      })),
    });

    for (const item of normalizedItems) {
      await tx.part.update({
        where: { id: item.part.id },
        data: { stockQty: { decrement: item.quantity } },
      });
    }

      await applyWalletLedgerEntry(
        {
          userId: input.userId,
          reference: idempotencyRef ?? `${reference}-WALLET`,
          amount: total,
          currency: "GHS",
          provider: "PAYSTACK",
          method: "MOBILE_MONEY",
          direction: "DEBIT",
          purpose: "PARTS_PURCHASE",
          orderId: order.id,
          paidAt: new Date(),
          actorUserId: input.userId,
        },
        tx,
      );

      await tx.notification.create({
        data: {
          userId: input.userId,
          type: NotificationType.ORDER,
          title: "Parts order confirmed",
          body: `Your order ${reference} was paid from wallet and receipt is available in order history.`,
          href: `/dashboard/orders/${order.id}`,
        },
      });

      if (input.clearFromCart) {
        await tx.partCartItem.deleteMany({
          where: {
            cart: { userId: input.userId },
            partId: { in: normalizedItems.map((i) => i.part.id) },
          },
        });
      }
      await tx.agreementLog.create({
        data: {
          userId: input.userId,
          orderId: order.id,
          agreementVersion: input.agreementVersion,
          policyIds: [input.agreementVersion],
          accepted: true,
        },
      });

      await createShipmentsForPaidPartsOrder(tx, {
        orderId: order.id,
        userId: input.userId,
        orderReference: order.reference,
        items: normalizedItems.map((i) => ({ partId: i.part.id, origin: i.part.origin })),
        chinaShippingChoice: chinaChoice,
        chinaFeeGhs: chinaFeeGhs > 0 ? chinaFeeGhs : undefined,
        chinaEta: chinaEta || undefined,
        chinaDeliveryMode,
      });

      return order;
    });
  } catch (e) {
    if (
      idempotencyRef &&
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      const existing = await prisma.walletTransaction.findUnique({
        where: { reference: idempotencyRef },
        select: { orderId: true, order: { select: { reference: true } } },
      });
      if (existing?.orderId) {
        return { orderId: existing.orderId, reference: existing.order?.reference ?? idempotencyRef };
      }
    }
    throw e;
  }

  try {
    const { receiptPdfUrl, templateData, receiptReference: pdfReference } = await generateAndPersistOrderReceiptPdf({
      scope: "PARTS",
      order: { reference: result.reference, amount: total, receiptReference },
      customerName: user.name ?? null,
      lines: makePartsReceiptLines({
        orderReference: result.reference,
        items: normalizedItems.map((i) => ({ title: i.part.title, quantity: i.quantity, total: i.lineTotal })),
        totalPaidGhs: total,
        paymentStatusLabel: "Fully Paid",
      }),
    });
    await prisma.order.update({
      where: { id: result.id },
      data: {
        receiptReference: pdfReference,
        receiptPdfUrl,
        receiptData: {
          ...(receipt as Prisma.InputJsonValue as object),
          ...(templateData as object),
          receiptType: "PARTS",
          reference: result.reference,
          items: normalizedItems.map((i) => ({
            title: i.part.title,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.lineTotal,
          })),
        } as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error("[parts-checkout] receipt pdf generation failed", err);
  }

  try {
    const partIds = [...new Set(normalizedItems.map((i) => i.part.id))];
    const updatedParts = await prisma.part.findMany({
      where: { id: { in: partIds } },
      select: {
        id: true,
        title: true,
        stockQty: true,
        origin: true,
        listingState: true,
        stockStatus: true,
      },
    });
    for (const p of updatedParts) {
      void maybeNotifyAdminsGhanaLowStock(p);
    }
  } catch (e) {
    console.error("[parts-checkout] ghana low stock notify", e);
  }

  return { orderId: result.id, reference: result.reference };
}
