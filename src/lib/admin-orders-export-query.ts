import { PaymentStatus, type OrderKind, type Prisma } from "@prisma/client";

import type { AdminPartsLineage } from "@/lib/admin-orders-parts-filter";
import { wherePartsLineageForAdminList } from "@/lib/admin-orders-parts-filter";
import { getCarDisplayPrice } from "@/lib/currency";
import type { GlobalCurrencySettings } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const ADMIN_ORDERS_PAGE_SIZE = 15;
export const ADMIN_ORDERS_EXPORT_MAX = 2000;

export type OrdersExportKindFilter = OrderKind | null;

/** Prisma clause for list + export (images, customer, shipments). */
export const adminOrderRichSelect = {
  id: true,
  reference: true,
  kind: true,
  orderStatus: true,
  paymentType: true,
  amount: true,
  currency: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  receiptData: true,
  user: { select: { email: true, name: true, phone: true } },
  car: {
    select: {
      id: true,
      slug: true,
      title: true,
      coverImageUrl: true,
      basePriceRmb: true,
      reservationDepositPercent: true,
      currency: true,
      images: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { url: true } },
    },
  },
  partItems: {
    orderBy: { createdAt: "asc" as const },
    select: {
      origin: true,
      id: true,
      titleSnapshot: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,
      currency: true,
      coverImageUrl: true,
      partId: true,
      part: {
        select: {
          id: true,
          slug: true,
          stockStatus: true,
          coverImageUrl: true,
          images: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { url: true } },
        },
      },
    },
  },
  payments: {
    orderBy: { createdAt: "desc" as const },
    select: { status: true, amount: true, paymentType: true, paidAt: true },
  },
  shipments: {
    orderBy: { updatedAt: "desc" as const },
    take: 3,
    select: {
      kind: true,
      deliveryMode: true,
      feeAmount: true,
      feeCurrency: true,
      deferredChinaShipping: true,
      estimatedDuration: true,
      currentStage: true,
    },
  },
} as const;

export type AdminOrderRich = Prisma.OrderGetPayload<{ select: typeof adminOrderRichSelect }>;

type ReceiptCarJson = {
  totalCarCostGhs?: number;
  totalPaidGhs?: number;
  outstandingBalanceGhs?: number;
} | null;

export function localTodayRange(): { gte: Date; lt: Date } {
  const gte = new Date();
  gte.setHours(0, 0, 0, 0);
  const lt = new Date(gte);
  lt.setDate(lt.getDate() + 1);
  return { gte, lt };
}

export function buildAdminOrdersBaseWhere(
  kindFilter: OrdersExportKindFilter,
  dateRange: { gte: Date; lt: Date } | null | undefined,
  partsLineage: AdminPartsLineage,
  searchWhere: Prisma.OrderWhereInput | null,
): Prisma.OrderWhereInput {
  const lineageWhere =
    !kindFilter || kindFilter === "PARTS" ? wherePartsLineageForAdminList(partsLineage) : undefined;
  const w: Prisma.OrderWhereInput[] = [];
  if (kindFilter) w.push({ kind: kindFilter });
  if (dateRange) w.push({ createdAt: { gte: dateRange.gte, lt: dateRange.lt } });
  if (lineageWhere) w.push(lineageWhere);
  if (searchWhere) w.push(searchWhere);
  return w.length > 0 ? { AND: w } : {};
}

export async function fetchAdminOrdersRich(
  where: Prisma.OrderWhereInput,
  opts?: { skip?: number; take?: number; orderIds?: string[] },
): Promise<AdminOrderRich[]> {
  const idFilter =
    opts?.orderIds && opts.orderIds.length > 0 ? { id: { in: opts.orderIds } } : undefined;
  const merged: Prisma.OrderWhereInput =
    idFilter && Object.keys(where).length > 0 ? { AND: [where, idFilter] } : idFilter ?? where;

  return prisma.order.findMany({
    where: merged,
    orderBy: { createdAt: "desc" },
    skip: opts?.skip,
    take: opts?.take ?? ADMIN_ORDERS_EXPORT_MAX,
    select: adminOrderRichSelect,
  });
}

export function firstCarImageUrl(car: AdminOrderRich["car"]): string {
  if (!car) return "";
  const g = car.images[0]?.url?.trim();
  if (g) return g;
  return car.coverImageUrl?.trim() ?? "";
}

export function firstPartLineImageUrl(line: AdminOrderRich["partItems"][number]): string {
  const snap = line.coverImageUrl?.trim();
  if (snap) return snap;
  const p = line.part;
  if (!p) return "";
  const g = p.images[0]?.url?.trim();
  if (g) return g;
  return p.coverImageUrl?.trim() ?? "";
}

export function totalSuccessfulPaymentsGhs(order: AdminOrderRich): number {
  return order.payments
    .filter((p) => p.status === PaymentStatus.SUCCESS)
    .reduce((s, p) => s + Number(p.amount), 0);
}

export function fullCarListGhs(order: AdminOrderRich, settings: Pick<GlobalCurrencySettings, "usdToRmb" | "rmbToGhs" | "usdToGhs">): number {
  const rmb = order.car ? Number(order.car.basePriceRmb) : 0;
  return Math.round(getCarDisplayPrice(rmb, "GHS", settings));
}

export function shippingSummary(order: AdminOrderRich): string {
  const s = order.shipments[0];
  if (!s) return "—";
  const mode = s.deliveryMode ? s.deliveryMode.replaceAll("_", " ") : "";
  const fee =
    s.feeAmount != null && Number(s.feeAmount) > 0
      ? `${Number(s.feeAmount)} ${s.feeCurrency}`
      : s.deferredChinaShipping
        ? "Intl. deferred"
        : "";
  return [s.kind.replaceAll("_", " "), mode, fee].filter(Boolean).join(" · ") || "—";
}

export function shippingFeeStatus(order: AdminOrderRich): string {
  const s = order.shipments[0];
  if (!s) return "—";
  if (s.deferredChinaShipping) return "International leg deferred";
  if (s.feeAmount != null && Number(s.feeAmount) > 0) return `Fee set (${s.feeCurrency})`;
  return "No fee on shipment row";
}

export type OrderFinancialPreview = {
  fullListGhs: number | null;
  depositPaidGhs: number | null;
  outstandingGhs: number | null;
  orderAmountGhs: number;
};

export function computeOrderFinancialPreview(
  order: AdminOrderRich,
  settings: Pick<GlobalCurrencySettings, "usdToRmb" | "rmbToGhs" | "usdToGhs">,
): OrderFinancialPreview {
  const orderAmountGhs = Number(order.amount);
  const paid = totalSuccessfulPaymentsGhs(order);
  const receipt = order.receiptData as ReceiptCarJson;

  if (order.kind === "CAR" && order.car) {
    const fullList = fullCarListGhs(order, settings);
    const totalPaid = receipt?.totalPaidGhs != null ? Number(receipt.totalPaidGhs) : paid;
    const outstanding =
      receipt?.outstandingBalanceGhs != null
        ? Math.max(0, Number(receipt.outstandingBalanceGhs))
        : Math.max(0, fullList - totalPaid);
    return {
      fullListGhs: fullList,
      depositPaidGhs: totalPaid > 0 ? totalPaid : null,
      outstandingGhs: outstanding,
      orderAmountGhs,
    };
  }

  const partsTotal = order.partItems.reduce((s, li) => s + Number(li.lineTotal), 0);
  const full = partsTotal > 0 ? partsTotal : orderAmountGhs;
  return {
    fullListGhs: full,
    depositPaidGhs: paid > 0 ? paid : null,
    outstandingGhs: Math.max(0, full - paid),
    orderAmountGhs,
  };
}
