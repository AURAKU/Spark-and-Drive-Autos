import { NotificationType, PartListingState, PartOrigin, PartStockStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Alert while Ghana on-hand stock is in this range (not zero-only). */
export const GHANA_LOW_STOCK_ALERT_MAX = 5;

const ADMIN_ROLES_FOR_STOCK_ALERT = [
  "SUPER_ADMIN",
  "SALES_ADMIN",
  "SOURCING_MANAGER",
  "LOGISTICS_MANAGER",
  "FINANCE_ADMIN",
] as const;

export function isGhanaListedAvailableLowStock(p: {
  origin: PartOrigin;
  listingState: PartListingState;
  stockQty: number;
  stockStatus: PartStockStatus;
}): boolean {
  if (p.origin !== PartOrigin.GHANA) return false;
  if (p.listingState !== PartListingState.PUBLISHED) return false;
  if (p.stockStatus === PartStockStatus.ON_REQUEST) return false;
  if (p.stockQty < 1 || p.stockQty > GHANA_LOW_STOCK_ALERT_MAX) return false;
  return true;
}

export async function getGhanaLowStockPartsForAdmin() {
  return prisma.part.findMany({
    where: {
      origin: PartOrigin.GHANA,
      listingState: PartListingState.PUBLISHED,
      stockStatus: { not: PartStockStatus.ON_REQUEST },
      stockQty: { gte: 1, lte: GHANA_LOW_STOCK_ALERT_MAX },
    },
    orderBy: [{ stockQty: "asc" }, { title: "asc" }],
    take: 80,
    select: { id: true, title: true, slug: true, stockQty: true, stockStatus: true, sku: true },
  });
}

async function getAdminUserIds(): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { role: { in: [...ADMIN_ROLES_FOR_STOCK_ALERT] } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/**
 * Notify all operations admins when Ghana warehouse stock is 1–5 for a published listing.
 * Dedupes: at most one alert per part per 12 hours (qty changes still restock-focused).
 */
export async function maybeNotifyAdminsGhanaLowStock(part: {
  id: string;
  title: string;
  stockQty: number;
  origin: PartOrigin;
  listingState: PartListingState;
  stockStatus: PartStockStatus;
}): Promise<void> {
  if (!isGhanaListedAvailableLowStock(part)) return;

  const since = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const marker = `partAlert:${part.id}`;
  const existing = await prisma.notification.findFirst({
    where: {
      body: { contains: marker },
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  if (existing) return;

  const adminIds = await getAdminUserIds();
  if (adminIds.length === 0) return;

  const tier =
    part.stockQty <= 1 ? "Critical" : part.stockQty <= 2 ? "Very low" : part.stockQty <= 3 ? "Low" : "Restock soon";

  const title = `Ghana stock · ${tier} (${part.stockQty} left)`;
  const body = `${marker}\n${part.title} — ${part.stockQty} unit(s) left in Ghana. Restock to avoid stockout.`;

  await prisma.notification.createMany({
    data: adminIds.map((userId) => ({
      userId,
      type: NotificationType.SYSTEM,
      title,
      body,
      href: `/admin/parts/${part.id}/edit`,
    })),
  });
}
