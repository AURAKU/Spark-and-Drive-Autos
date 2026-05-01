import type { GlobalCurrencySettings } from "@prisma/client";

import { orderPartsLineageLabel } from "@/lib/admin-orders-parts-filter";
import {
  type AdminOrderRich,
  computeOrderFinancialPreview,
  firstCarImageUrl,
  firstPartLineImageUrl,
  shippingFeeStatus,
  shippingSummary,
} from "@/lib/admin-orders-export-query";
import { formatMoney } from "@/lib/format";
import { orderItemTitleSummary } from "@/lib/order-item-display";

export type AdminOrderPreviewPayload = {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  itemTitle: string;
  itemTypeLabel: string;
  quantityLabel: string;
  productPrice: string;
  depositPaid: string;
  outstanding: string;
  paymentStatus: string;
  paymentType: string;
  deliveryMode: string;
  shippingFeeStatus: string;
  orderDateIso: string;
  dueOrEta: string | null;
  imageUrl: string | null;
  adminNotes: string | null;
};

export type AdminOrderListRowSerialized = {
  id: string;
  reference: string;
  kind: "CAR" | "PARTS";
  itemTitle: string;
  itemHref: string | null;
  orderStatus: string;
  paymentStatus: string | null;
  amount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  partsLineageLabel: string;
  preview: AdminOrderPreviewPayload;
};

export function buildAdminOrderListRow(
  o: AdminOrderRich,
  settings: Pick<GlobalCurrencySettings, "usdToRmb" | "rmbToGhs" | "usdToGhs">,
): AdminOrderListRowSerialized {
  const fin = computeOrderFinancialPreview(o, settings);
  const imageUrlRaw =
    o.kind === "CAR"
      ? firstCarImageUrl(o.car)
      : o.partItems[0]
        ? firstPartLineImageUrl(o.partItems[0])
        : "";
  const imageUrl = imageUrlRaw.trim() || null;

  let itemHref: string | null = null;
  if (o.kind === "CAR" && o.car?.slug) {
    itemHref = `/cars/${o.car.slug}`;
  } else if (o.kind === "PARTS") {
    const slug = o.partItems[0]?.part?.slug;
    if (slug) itemHref = `/parts/${slug}`;
  }

  const qty =
    o.kind === "CAR"
      ? "1"
      : o.partItems.length === 0
        ? "0"
        : String(o.partItems.reduce((s, li) => s + li.quantity, 0));

  const preview: AdminOrderPreviewPayload = {
    orderNumber: o.reference,
    customerName: o.user?.name?.trim() || "—",
    customerEmail: o.user?.email ?? "—",
    customerPhone: o.user?.phone?.trim() || "—",
    itemTitle: orderItemTitleSummary(o),
    itemTypeLabel: o.kind === "CAR" ? "Vehicle (car)" : "Parts & accessories",
    quantityLabel: qty,
    productPrice:
      fin.fullListGhs != null ? formatMoney(fin.fullListGhs, o.currency) : formatMoney(fin.orderAmountGhs, o.currency),
    depositPaid: fin.depositPaidGhs != null ? formatMoney(fin.depositPaidGhs, o.currency) : "—",
    outstanding: fin.outstandingGhs != null ? formatMoney(fin.outstandingGhs, o.currency) : "—",
    paymentStatus: String(o.payments[0]?.status ?? "—"),
    paymentType: o.paymentType.replaceAll("_", " "),
    deliveryMode: shippingSummary(o),
    shippingFeeStatus: shippingFeeStatus(o),
    orderDateIso: o.createdAt.toISOString(),
    dueOrEta: o.shipments[0]?.estimatedDuration?.trim() || null,
    imageUrl,
    adminNotes: o.notes?.trim() || null,
  };

  return {
    id: o.id,
    reference: o.reference,
    kind: o.kind,
    itemTitle: preview.itemTitle,
    itemHref,
    orderStatus: o.orderStatus,
    paymentStatus: o.payments[0]?.status ?? null,
    amount: Number(o.amount),
    currency: o.currency,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    partsLineageLabel: orderPartsLineageLabel(o),
    preview,
  };
}
