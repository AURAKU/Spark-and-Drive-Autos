import { NotificationType, OrderKind, Prisma, type DeliveryMode, type OrderStatus, type PartOrigin } from "@prisma/client";

import { ensureDutyRecordForCarSeaInTx } from "@/lib/duty/ensure-duty-record";
import { prisma } from "@/lib/prisma";

import { computeChinaShippingQuote, type ChinaShippingChoice } from "./parts-china-fees";
import type { TxClient } from "./parts-china-fees";

/** Do not create vehicle shipment rows for unpaid / cancelled orders (avoids fake tracking). */
const CAR_SHIPMENT_BACKFILL_BLOCKED = new Set<OrderStatus>(["DRAFT", "PENDING_PAYMENT", "CANCELLED"]);

function buildTrackingNumber(kind: "PARTS_GHANA" | "PARTS_CHINA" | "CAR_SEA") {
  const prefix = kind === "CAR_SEA" ? "SDA-CAR" : kind === "PARTS_CHINA" ? "SDA-PCN" : "SDA-PGH";
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 12);
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

function makeShipmentSearchWhere(query: string): Prisma.ShipmentWhereInput {
  const q = query.trim();
  if (!q) return {};
  return {
    OR: [
      { trackingNumber: { contains: q, mode: "insensitive" } },
      { carrier: { contains: q, mode: "insensitive" } },
      { order: { reference: { contains: q, mode: "insensitive" } } },
      { order: { car: { title: { contains: q, mode: "insensitive" } } } },
      { order: { partItems: { some: { titleSnapshot: { contains: q, mode: "insensitive" } } } } },
    ],
  };
}

async function assignMissingTrackingNumbers(ids: string[]) {
  if (ids.length === 0) return;
  const ships = await prisma.shipment.findMany({
    where: { id: { in: ids }, trackingNumber: null },
    select: { id: true, kind: true },
  });
  if (ships.length === 0) return;
  await prisma.$transaction(
    ships.map((s) =>
      prisma.shipment.update({
        where: { id: s.id },
        data: { trackingNumber: buildTrackingNumber(s.kind) },
      }),
    ),
  );
}

export async function createShipmentsForPaidPartsOrder(
  tx: TxClient,
  params: {
    orderId: string;
    userId: string;
    orderReference: string;
    items: Array<{ partId: string; origin: PartOrigin }>;
    chinaShippingChoice?: ChinaShippingChoice;
    chinaFeeGhs?: number;
    chinaEta?: string;
    chinaDeliveryMode?: DeliveryMode;
  },
): Promise<void> {
  const hasGhana = params.items.some((i) => i.origin === "GHANA");
  const hasChina = params.items.some((i) => i.origin === "CHINA");
  if (hasChina) {
    if (
      params.chinaShippingChoice == null ||
      params.chinaFeeGhs == null ||
      params.chinaDeliveryMode == null
    ) {
      throw new Error("CHINA_SHIPPING_REQUIRED");
    }
  }

  if (hasGhana) {
    const s = await tx.shipment.create({
      data: {
        orderId: params.orderId,
        kind: "PARTS_GHANA",
        trackingNumber: buildTrackingNumber("PARTS_GHANA"),
        currentStage: "PROCESSING",
        feeAmount: 0,
        feeCurrency: "GHS",
        estimatedDuration: "Local delivery in Ghana",
      },
    });
    await tx.shipmentStatusEvent.create({
      data: {
        shipmentId: s.id,
        stage: "PROCESSING",
        title: "Processing",
        description: "Ghana-stock items are being prepared for dispatch to your saved address.",
        visibleToCustomer: true,
      },
    });
  }

  if (hasChina) {
    const s = await tx.shipment.create({
      data: {
        orderId: params.orderId,
        kind: "PARTS_CHINA",
        trackingNumber: buildTrackingNumber("PARTS_CHINA"),
        deliveryMode: params.chinaDeliveryMode!,
        feeAmount: params.chinaFeeGhs!,
        feeCurrency: "GHS",
        estimatedDuration: params.chinaEta ?? null,
        currentStage: "PENDING_SHIPPING_SETUP",
      },
    });
    const modeLabel = params.chinaShippingChoice === "SEA" ? "Sea" : "Air";
    await tx.shipmentStatusEvent.create({
      data: {
        shipmentId: s.id,
        stage: "PENDING_SHIPPING_SETUP",
        title: "Shipping setup",
        description: `International parts shipping (${modeLabel}) is being arranged. Fee GHS ${params.chinaFeeGhs!.toFixed(2)}.`,
        visibleToCustomer: true,
      },
    });
  }

  await tx.notification.create({
    data: {
      userId: params.userId,
      type: NotificationType.SHIPPING,
      title: "Shipping updates available",
      body: `Logistics for order ${params.orderReference} — open your order to track progress.`,
      href: `/dashboard/orders/${params.orderId}`,
    },
  });
}

export async function ensureCarSeaShipmentInTx(
  tx: TxClient,
  params: {
    orderId: string;
    userId: string | null;
    orderReference: string;
    feeGhs: number | null;
    estimatedDuration: string | null;
  },
): Promise<void> {
  const existing = await tx.shipment.findFirst({
    where: { orderId: params.orderId, kind: "CAR_SEA" },
    select: { id: true },
  });
  if (existing) return;

  const s = await tx.shipment.create({
    data: {
      orderId: params.orderId,
      kind: "CAR_SEA",
      trackingNumber: buildTrackingNumber("CAR_SEA"),
      deliveryMode: "SEA",
      feeAmount: params.feeGhs != null ? params.feeGhs : null,
      feeCurrency: "GHS",
      estimatedDuration: params.estimatedDuration ?? "Sea freight to Ghana — timing confirmed by operations.",
      currentStage: "PENDING_SHIPPING_SETUP",
    },
  });
  await tx.shipmentStatusEvent.create({
    data: {
      shipmentId: s.id,
      stage: "PENDING_SHIPPING_SETUP",
      title: "Sea freight booked",
      description: "Your vehicle will move on sea freight to Ghana. Operations will post milestones here.",
      visibleToCustomer: true,
    },
  });

  if (params.userId) {
    await tx.notification.create({
      data: {
        userId: params.userId,
        type: NotificationType.SHIPPING,
        title: "Vehicle shipping",
        body: `Sea shipment for ${params.orderReference} is set up. Track progress in your order.`,
        href: `/dashboard/orders/${params.orderId}`,
      },
    });
  }

  await ensureDutyRecordForCarSeaInTx(tx, { orderId: params.orderId, shipmentId: s.id });
}

/** Backfill car orders that paid before shipments existed (safe no-op if already present). */
export async function backfillCarShipmentIfMissing(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      car: { select: { seaShippingFeeGhs: true, estimatedDelivery: true } },
    },
  });
  if (!order || order.kind !== "CAR" || !order.userId) return;
  if (CAR_SHIPMENT_BACKFILL_BLOCKED.has(order.orderStatus)) return;
  const existing = await prisma.shipment.findFirst({ where: { orderId, kind: "CAR_SEA" } });
  if (existing) return;
  await prisma.$transaction(async (tx) => {
    await ensureCarSeaShipmentInTx(tx, {
      orderId: order.id,
      userId: order.userId,
      orderReference: order.reference,
      feeGhs: order.car?.seaShippingFeeGhs != null ? Number(order.car.seaShippingFeeGhs) : null,
      estimatedDuration: order.car?.estimatedDelivery ?? null,
    });
  });
}

/**
 * Legacy wallet parts orders that predate `Shipment` — only runs when PAID, has line items, zero shipments,
 * and (if China lines exist) freight can be inferred from receipt or order total.
 */
export async function backfillPaidPartsShipmentsIfMissing(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      kind: true,
      userId: true,
      reference: true,
      orderStatus: true,
      amount: true,
      receiptData: true,
      partItems: { select: { partId: true, origin: true, lineTotal: true } },
    },
  });
  if (!order || order.kind !== "PARTS" || !order.userId) return;
  if (order.orderStatus !== "PAID") return;
  if (order.partItems.length === 0) return;

  const shipmentCount = await prisma.shipment.count({ where: { orderId } });
  if (shipmentCount > 0) return;

  const items: Array<{ partId: string; origin: PartOrigin }> = [];
  for (const row of order.partItems) {
    if (row.partId == null) continue;
    items.push({ partId: row.partId, origin: row.origin });
  }
  if (items.length === 0) return;

  const hasChina = items.some((i) => i.origin === "CHINA");

  let chinaShippingChoice: ChinaShippingChoice | undefined;
  let chinaFeeGhs: number | undefined;
  let chinaEta: string | undefined;
  let chinaDeliveryMode: DeliveryMode | undefined;

  if (hasChina) {
    const receipt = order.receiptData as { items?: Array<{ title?: string; total?: number }> } | null;
    let fee = 0;
    let choice: ChinaShippingChoice = "SEA";
    for (const it of receipt?.items ?? []) {
      const title = it.title ?? "";
      if (/international shipping/i.test(title)) {
        fee = Number(it.total ?? 0);
        if (/sea/i.test(title)) choice = "SEA";
        else if (/air/i.test(title)) choice = "AIR";
        break;
      }
    }
    const partsSubtotal = order.partItems.reduce((sum, row) => sum + Number(row.lineTotal), 0);
    const inferred = Number(order.amount) - partsSubtotal;
    if (fee <= 0 && inferred > 0.009) fee = inferred;
    if (fee <= 0) {
      const ghanaOnly = items.filter((i) => i.origin === "GHANA");
      if (ghanaOnly.length === 0) return;
      await prisma.$transaction(async (tx) => {
        await createShipmentsForPaidPartsOrder(tx, {
          orderId: order.id,
          userId: order.userId!,
          orderReference: order.reference,
          items: ghanaOnly,
        });
      });
      return;
    }

    chinaShippingChoice = choice;
    chinaFeeGhs = fee;
    const chinaPartIds = [...new Set(items.filter((i) => i.origin === "CHINA").map((i) => i.partId))];
    const quote = await computeChinaShippingQuote(chinaPartIds, choice);
    chinaDeliveryMode = quote.deliveryMode;
    chinaEta = quote.etaSummary;
  }

  await prisma.$transaction(async (tx) => {
    await createShipmentsForPaidPartsOrder(tx, {
      orderId: order.id,
      userId: order.userId!,
      orderReference: order.reference,
      items,
      chinaShippingChoice,
      chinaFeeGhs,
      chinaEta,
      chinaDeliveryMode,
    });
  });
}

/** Ensures legacy orders gain shipment rows before listing (bounded, idempotent). */
export async function backfillOpenShipmentsForUser(userId: string): Promise<void> {
  const orders = await prisma.order.findMany({
    where: {
      userId,
      shipments: { none: {} },
      OR: [
        { kind: "PARTS", orderStatus: "PAID" },
        {
          kind: "CAR",
          orderStatus: { notIn: [...CAR_SHIPMENT_BACKFILL_BLOCKED] },
        },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 25,
    select: { id: true, kind: true },
  });
  for (const o of orders) {
    if (o.kind === "PARTS") await backfillPaidPartsShipmentsIfMissing(o.id);
    await backfillCarShipmentIfMissing(o.id);
  }
}

export async function listShipmentsForAdminDashboard(take = 80, query?: string) {
  const where = makeShipmentSearchWhere(query ?? "");
  const rows = await prisma.shipment.findMany({
    take,
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      order: {
        include: {
          user: { select: { id: true, email: true, name: true } },
          car: { select: { id: true, title: true, slug: true } },
          partItems: { select: { id: true, titleSnapshot: true, origin: true, quantity: true } },
          deliveryAddress: {
            select: {
              fullName: true,
              phone: true,
              city: true,
              region: true,
              streetAddress: true,
            },
          },
        },
      },
      events: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { createdBy: { select: { email: true } } },
      },
    },
  });
  const missingIds = rows.filter((r) => !r.trackingNumber).map((r) => r.id);
  await assignMissingTrackingNumbers(missingIds);
  if (missingIds.length === 0) return rows;
  return prisma.shipment.findMany({
    take,
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      order: {
        include: {
          user: { select: { id: true, email: true, name: true } },
          car: { select: { id: true, title: true, slug: true } },
          partItems: { select: { id: true, titleSnapshot: true, origin: true, quantity: true } },
          deliveryAddress: {
            select: {
              fullName: true,
              phone: true,
              city: true,
              region: true,
              streetAddress: true,
            },
          },
        },
      },
      events: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { createdBy: { select: { email: true } } },
      },
    },
  });
}

const USER_SHIPMENTS_PAGE_SIZE = 10;

export type UserShipmentListParams = {
  /** Search: tracking #, order ref, car title, part title */
  q?: string;
  /** `all` | `cars` | `parts` — filter by order kind (vehicle vs parts & accessories). */
  type?: string;
  /** 1-based page */
  page?: number;
};

export type UserShipmentListResult = {
  items: Awaited<ReturnType<typeof fetchUserShipmentsPage>>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

async function fetchUserShipmentsPage(
  where: Prisma.ShipmentWhereInput,
  skip: number,
  take: number,
) {
  return prisma.shipment.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    skip,
    take,
    include: {
      order: {
        select: {
          id: true,
          reference: true,
          kind: true,
          orderStatus: true,
          car: { select: { title: true, slug: true } },
        },
      },
      events: {
        where: { visibleToCustomer: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

function orderKindFromFilter(type: string | undefined): OrderKind | null {
  const t = (type ?? "all").toLowerCase();
  if (t === "cars" || t === "car") return "CAR";
  if (t === "parts" || t === "part" || t === "accessories") return "PARTS";
  return null;
}

/**
 * User-facing shipping list: search, Cars vs Parts filter, and pagination (10 per page).
 */
export async function listShipmentsForUser(
  userId: string,
  params: UserShipmentListParams = {},
): Promise<UserShipmentListResult> {
  await backfillOpenShipmentsForUser(userId);

  const q = params.q?.trim() ?? "";
  const queryWhere = makeShipmentSearchWhere(q);
  const orderKind = orderKindFromFilter(params.type);
  const orderKindWhere: Prisma.ShipmentWhereInput =
    orderKind == null ? {} : { order: { kind: orderKind } };

  const where: Prisma.ShipmentWhereInput = {
    AND: [{ order: { userId } }, orderKindWhere, queryWhere],
  };

  const page = Math.max(1, params.page ?? 1);
  const pageSize = USER_SHIPMENTS_PAGE_SIZE;

  const total = await prisma.shipment.count({ where });
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
  const safePage = total === 0 ? 1 : Math.min(page, totalPages);
  const finalSkip = (safePage - 1) * pageSize;

  let rows = await fetchUserShipmentsPage(where, finalSkip, pageSize);
  const missingIds = rows.filter((r) => !r.trackingNumber).map((r) => r.id);
  await assignMissingTrackingNumbers(missingIds);
  if (missingIds.length > 0) {
    rows = await fetchUserShipmentsPage(where, finalSkip, pageSize);
  }

  return {
    items: rows,
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export async function getShipmentsForOrderDetail(orderId: string, userId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: { id: true },
  });
  if (!order) return [];
  await backfillPaidPartsShipmentsIfMissing(orderId);
  await backfillCarShipmentIfMissing(orderId);
  return prisma.shipment.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
    include: {
      events: {
        where: { visibleToCustomer: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

/** Admin-only: shipments for an order with full event history (including non–customer-visible). */
export async function getShipmentsForAdminOrderDetail(orderId: string) {
  await backfillPaidPartsShipmentsIfMissing(orderId);
  await backfillCarShipmentIfMissing(orderId);
  return prisma.shipment.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
    include: {
      events: { orderBy: { createdAt: "asc" } },
    },
  });
}
