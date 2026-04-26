import { nanoid } from "nanoid";
import { NotificationType, Prisma, ReceiptType } from "@prisma/client";

import { isChinaPreOrderPart } from "@/lib/part-china-preorder-delivery";
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
import { createShipmentsForPaidPartsOrder, type ChinaShipmentLeg } from "@/lib/shipping/shipment-service";
import { getCheckoutLegalVersions } from "@/lib/legal-enforcement";
import { applyWalletLedgerEntry } from "@/lib/wallet-ledger";
import {
  formatOptionsLine,
  parsePartOptionsMeta,
  validateSelectionAgainstPart,
  type SelectedPartOptions,
} from "@/lib/part-variant-options";

export type PartsCheckoutLine = {
  partId: string;
  quantity: number;
  options?: SelectedPartOptions;
  /** When checking out from cart, pass cart line ids for exact removal. */
  cartItemId?: string;
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

function optionsToJson(opts: SelectedPartOptions | undefined): Prisma.InputJsonValue | undefined {
  if (!opts) return undefined;
  const o: Record<string, string> = {};
  if (opts.color?.trim()) o.color = opts.color.trim();
  if (opts.size?.trim()) o.size = opts.size.trim();
  if (opts.partType?.trim()) o.partType = opts.partType.trim();
  if (Object.keys(o).length === 0) return undefined;
  return o as Prisma.InputJsonValue;
}

export async function createPartsWalletOrder(input: {
  userId: string;
  addressId: string;
  items: PartsCheckoutLine[];
  clearFromCart?: boolean;
  /**
   * When set with clearFromCart, removes exact cart lines (required when variants share the same partId).
   */
  clearCartItemIds?: string[];
  requestKey?: string;
  agreementVersion: string;
  /**
   * Number dispatch should call on arrival (defaults to the saved address phone if omitted).
   */
  dispatchPhone?: string;
  /** Customer notes: gate, landmark, delivery instructions. */
  deliveryInstructions?: string | null;
  /**
   * Required when the order includes any China in-stock (non pre-order) parts — same Air/Sea as storefront.
   * Omitted when the cart only has China "Pre order" lines (international leg paid later).
   */
  chinaShippingChoice?: ChinaShippingChoice;
}): Promise<{ orderId: string; reference: string }> {
  if (input.items.length === 0) throw new Error("Select at least one item.");
  const legal = await getCheckoutLegalVersions();
  if (input.agreementVersion !== legal.agreementVersion) {
    throw new Error("STALE_CHECKOUT_AGREEMENT");
  }
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
      select: {
        id: true,
        title: true,
        stockQty: true,
        stockStatus: true,
        origin: true,
        basePriceRmb: true,
        priceGhs: true,
        coverImageUrl: true,
        metaJson: true,
      },
    }),
  ]);

  if (!user) throw new Error("User not found.");
  if (!address) throw new Error("Delivery address is required.");
  const dispatchPhone = (input.dispatchPhone?.trim() || address.phone).trim();
  if (dispatchPhone.length < 8) {
    throw new Error("Enter a dispatch phone number (at least 8 characters) for delivery contact.");
  }
  const deliveryInstructions = input.deliveryInstructions?.trim() || null;
  if (deliveryInstructions && deliveryInstructions.length > 2000) {
    throw new Error("Delivery instructions are too long (max 2000 characters).");
  }

  const partMap = new Map(dbParts.map((p) => [p.id, p]));
  const qtyByPart = new Map<string, number>();
  for (const it of input.items) {
    qtyByPart.set(it.partId, (qtyByPart.get(it.partId) ?? 0) + it.quantity);
  }
  for (const [partId, totalQty] of qtyByPart) {
    const part = partMap.get(partId);
    if (!part) throw new Error("Some selected items are unavailable.");
    if (!isChinaPreOrderPart(part)) {
      if (part.stockQty < 1) {
        throw new PartsStockError(
          partOutOfStockCustomerMessage(part.title),
          "OUT_OF_STOCK",
          part.title,
          0,
          totalQty,
        );
      }
      if (part.stockQty < totalQty) {
        throw new PartsStockError(
          partQuantityExceedsStockMessage(part.title, totalQty, part.stockQty),
          "INSUFFICIENT_STOCK",
          part.title,
          part.stockQty,
          totalQty,
        );
      }
    }
  }
  const normalizedItems = input.items.map((item) => {
    const part = partMap.get(item.partId);
    if (!part) throw new Error("Some selected items are unavailable.");
    if (item.quantity < 1) throw new Error("Invalid item quantity.");
    const lists = parsePartOptionsMeta(part.metaJson);
    const opt = item.options ?? {};
    const v = validateSelectionAgainstPart(lists, opt);
    if (!v.ok) throw new Error(v.error);
    const unitPrice = getPartDisplayPrice(
      { origin: part.origin, basePriceRmb: Number(part.basePriceRmb), priceGhs: Number(part.priceGhs) },
      "GHS",
      fx,
    ).amount;
    const lineTotal = unitPrice * item.quantity;
    return { part, quantity: item.quantity, unitPrice, lineTotal, options: item.options, cartItemId: item.cartItemId };
  });

  const partsSubtotal = normalizedItems.reduce((sum, i) => sum + i.lineTotal, 0);
  const chinaItemPartIds = [...new Set(normalizedItems.filter((i) => i.part.origin === "CHINA").map((i) => i.part.id))];
  const billableChinaPartIds = [
    ...new Set(
      normalizedItems
        .filter((i) => i.part.origin === "CHINA" && !isChinaPreOrderPart(i.part))
        .map((i) => i.part.id),
    ),
  ];
  const hasPreorderChina = normalizedItems.some(
    (i) => i.part.origin === "CHINA" && isChinaPreOrderPart(i.part),
  );
  const chinaLegs: ChinaShipmentLeg[] = [];
  let chinaTotalAtCheckout = 0;
  if (billableChinaPartIds.length > 0) {
    if (!input.chinaShippingChoice) throw new Error("Select Air or Sea shipping for China in-stock parts.");
    const q = await computeChinaShippingQuote(billableChinaPartIds, input.chinaShippingChoice, { forCheckout: true });
    chinaTotalAtCheckout = q.feeGhs;
    chinaLegs.push({
      deferred: false,
      chinaShippingChoice: input.chinaShippingChoice,
      chinaFeeGhs: q.feeGhs,
      chinaEta: q.etaSummary,
      chinaDeliveryMode: q.deliveryMode,
      legLabel: "China (in-stock lines)",
    });
  }
  if (hasPreorderChina) {
    chinaLegs.push({ deferred: true, legLabel: "Pre-order (China)" });
  }
  if (chinaItemPartIds.length > 0 && chinaLegs.length === 0) {
    throw new Error("China shipment setup failed. Contact support.");
  }
  const total = partsSubtotal + chinaTotalAtCheckout;
  if (Number(user.walletBalance) < total) throw new Error("Insufficient wallet balance.");

  const reference = `SDA-PART-${nanoid(10).toUpperCase()}`;
  const receiptReference = createReceiptReference();
  const lineTitle = (i: (typeof normalizedItems)[number]) => {
    const extra = formatOptionsLine(i.options ?? {});
    return extra ? `${i.part.title} — ${extra}` : i.part.title;
  };
  const receiptLineItems = normalizedItems.map((i) => ({
    title: lineTitle(i),
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    total: i.lineTotal,
  }));
  for (const leg of chinaLegs) {
    if (!leg.deferred && (leg.chinaFeeGhs ?? 0) > 0) {
      receiptLineItems.push({
        title: `International shipping — ${leg.legLabel} (${leg.chinaShippingChoice === "SEA" ? "Sea" : "Air"})`,
        quantity: 1,
        unitPrice: leg.chinaFeeGhs!,
        total: leg.chinaFeeGhs!,
      });
    }
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
    /** Number operations/dispatch should call; may differ from saved profile phone. */
    dispatchPhone,
    /** Saved address phone for reference. */
    savedAddressPhone: address.phone,
    deliveryInstructions,
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
      data: normalizedItems.map((i) => {
        const oj = optionsToJson(i.options);
        return {
          orderId: order.id,
          partId: i.part.id,
          titleSnapshot: lineTitle(i),
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
          currency: "GHS",
          coverImageUrl: i.part.coverImageUrl,
          origin: i.part.origin,
          ...(oj !== undefined ? { optionsJson: oj } : {}),
        };
      }),
    });

    const decByPart = new Map<string, number>();
    for (const item of normalizedItems) {
      if (isChinaPreOrderPart(item.part)) continue;
      decByPart.set(item.part.id, (decByPart.get(item.part.id) ?? 0) + item.quantity);
    }
    for (const [partId, dec] of decByPart) {
      await tx.part.update({
        where: { id: partId },
        data: { stockQty: { decrement: dec } },
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
        const byId = (input.clearCartItemIds ?? []).filter(Boolean);
        if (byId.length > 0) {
          await tx.partCartItem.deleteMany({
            where: { id: { in: byId }, cart: { userId: input.userId } },
          });
        } else {
          await tx.partCartItem.deleteMany({
            where: {
              cart: { userId: input.userId },
              partId: { in: normalizedItems.map((i) => i.part.id) },
            },
          });
        }
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
        chinaLegs: chinaLegs.length > 0 ? chinaLegs : undefined,
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
      scope: ReceiptType.PARTS_PAYMENT,
      order: { reference: result.reference, amount: total, receiptReference },
      customerName: user.name ?? null,
      lines: makePartsReceiptLines({
        orderReference: result.reference,
        items: normalizedItems.map((i) => ({
          title: lineTitle(i),
          quantity: i.quantity,
          total: i.lineTotal,
        })),
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
            title: lineTitle(i),
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
