import { loadMembershipSnapshotForUser } from "@/lib/parts-finder/access";
import { listShipmentsForUser } from "@/lib/shipping/shipment-service";
import { prisma } from "@/lib/prisma";
import { SHIPMENT_KIND_LABEL, SHIPMENT_STAGE_LABEL } from "@/lib/shipping/constants";

const MS_PER_DAY = 86_400_000;

const ACTIVE_STAGES = new Set([
  "PENDING_SHIPPING_SETUP",
  "PROCESSING",
  "READY_FOR_DISPATCH",
  "IN_TRANSIT",
  "ARRIVED",
  "OUT_FOR_DELIVERY",
  "DELAYED",
]);

export type DashboardIntelligence = {
  generatedAt: string;
  displayName: string;
  walletGhs: number;
  unreadNotifications: number;
  ordersTotal: number;
  recentOrders: Array<{
    id: string;
    reference: string;
    kind: string;
    orderStatus: string;
    createdAt: string;
    amount: number;
    currency: string;
  }>;
  partsCartItemCount: number;
  favoritesCount: number;
  successfulPaymentsCount: number;
  partsFinder: {
    state: string;
    activeFrom: string | null;
    activeUntil: string | null;
    daysRemaining: number | null;
    renewalRequired: boolean;
  };
  partsFinderSearches7d: number;
  shipments: Array<{
    id: string;
    kind: string;
    kindLabel: string;
    currentStage: string;
    stageLabel: string;
    trackingNumber: string | null;
    orderRef: string;
    orderId: string;
    headline: string;
    updatedAt: string;
  }>;
  inMotionShipmentCount: number;
};

function daysUntil(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.max(0, Math.ceil((end - now) / MS_PER_DAY));
}

export async function getDashboardIntelligence(
  userId: string,
  options: { displayName: string },
): Promise<DashboardIntelligence> {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * MS_PER_DAY);

  const [
    user,
    ordersTotal,
    recentOrders,
    notifUnread,
    cartAgg,
    favoritesCount,
    paySuccess,
    pf,
    sessionCount7d,
    shipmentPage,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true } }),
    prisma.order.count({ where: { userId } }),
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        reference: true,
        kind: true,
        orderStatus: true,
        createdAt: true,
        amount: true,
        currency: true,
      },
    }),
    prisma.notification.count({ where: { userId, read: false } }),
    prisma.partCartItem.aggregate({
      where: { cart: { userId } },
      _sum: { quantity: true },
    }),
    prisma.favorite.count({ where: { userId } }),
    prisma.payment.count({ where: { userId, status: "SUCCESS" } }),
    loadMembershipSnapshotForUser(userId),
    prisma.partsFinderSearchSession.count({
      where: { userId, createdAt: { gte: sevenDaysAgo } },
    }),
    listShipmentsForUser(userId, { page: 1 }),
  ]);

  const walletGhs = Number(user?.walletBalance ?? 0);
  const partsCartItemCount = Number(cartAgg._sum.quantity ?? 0);

  const daysRemaining =
    pf.state === "ACTIVE" && pf.activeUntil ? daysUntil(pf.activeUntil, now) : null;

  const shipments: DashboardIntelligence["shipments"] = shipmentPage.items.slice(0, 5).map((s) => {
    const carTitle = s.order.kind === "CAR" ? s.order.car?.title?.trim() : null;
    const headline =
      s.order.kind === "CAR" && carTitle
        ? carTitle
        : s.order.kind === "PARTS"
          ? "Parts & accessories"
          : "Order";
    return {
      id: s.id,
      kind: s.kind,
      kindLabel: SHIPMENT_KIND_LABEL[s.kind] ?? s.kind,
      currentStage: s.currentStage,
      stageLabel: SHIPMENT_STAGE_LABEL[s.currentStage],
      trackingNumber: s.trackingNumber,
      orderRef: s.order.reference,
      orderId: s.order.id,
      headline,
      updatedAt: s.updatedAt.toISOString(),
    };
  });

  const inMotionShipmentCount = shipmentPage.items.filter((s) => ACTIVE_STAGES.has(s.currentStage)).length;

  return {
    generatedAt: new Date(now).toISOString(),
    displayName: options.displayName,
    walletGhs,
    unreadNotifications: notifUnread,
    ordersTotal,
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      reference: o.reference,
      kind: o.kind,
      orderStatus: o.orderStatus,
      createdAt: o.createdAt.toISOString(),
      amount: Number(o.amount),
      currency: o.currency,
    })),
    partsCartItemCount,
    favoritesCount,
    successfulPaymentsCount: paySuccess,
    partsFinder: {
      state: pf.state,
      activeFrom: pf.activeFrom,
      activeUntil: pf.activeUntil,
      daysRemaining,
      renewalRequired: pf.renewalRequired,
    },
    partsFinderSearches7d: sessionCount7d,
    shipments,
    inMotionShipmentCount,
  };
}
