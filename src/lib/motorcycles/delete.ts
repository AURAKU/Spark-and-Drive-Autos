import { CarListingState } from "@prisma/client";

import { auditLog } from "@/lib/leads";
import { prisma } from "@/lib/prisma";

export type MotorcycleDeleteResult =
  | { ok: true; mode: "hard" | "soft" }
  | { error: string };

/**
 * Safe delete:
 * - Hard-delete when no order/reservation history
 * - Soft-delete (deletedAt + HIDDEN) when financial history exists
 */
export async function deleteMotorcycleSafe(params: {
  id: string;
  actorId: string;
  forceSoft?: boolean;
}): Promise<MotorcycleDeleteResult> {
  const m = await prisma.motorcycle.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      slug: true,
      title: true,
      year: true,
      deletedAt: true,
      _count: { select: { orders: true, favorites: true } },
    },
  });
  if (!m) return { error: "Not found." };
  if (m.deletedAt) return { error: "Already deleted." };

  const hasOrderHistory = m._count.orders > 0;
  if (hasOrderHistory || params.forceSoft) {
    await prisma.motorcycle.update({
      where: { id: m.id },
      data: {
        deletedAt: new Date(),
        archivedAt: new Date(),
        listingState: CarListingState.HIDDEN,
        featured: false,
        version: { increment: 1 },
      },
    });
    await auditLog(params.actorId, "motorcycle.softDelete", "Motorcycle", m.id, {
      slug: m.slug,
      title: m.title,
      year: m.year,
      orders: m._count.orders,
    });
    return { ok: true, mode: "soft" };
  }

  await prisma.motorcycle.delete({ where: { id: m.id } });
  await auditLog(params.actorId, "motorcycle.delete", "Motorcycle", m.id, {
    slug: m.slug,
    title: m.title,
    year: m.year,
  });
  return { ok: true, mode: "hard" };
}

export async function restoreMotorcycleSoftDeleted(params: {
  id: string;
  actorId: string;
}): Promise<{ ok: true } | { error: string }> {
  const m = await prisma.motorcycle.findUnique({
    where: { id: params.id },
    select: { id: true, slug: true, deletedAt: true },
  });
  if (!m) return { error: "Not found." };
  if (!m.deletedAt) return { error: "Motorcycle is not soft-deleted." };
  await prisma.motorcycle.update({
    where: { id: m.id },
    data: {
      deletedAt: null,
      listingState: CarListingState.DRAFT,
      version: { increment: 1 },
    },
  });
  await auditLog(params.actorId, "motorcycle.restore", "Motorcycle", m.id, { slug: m.slug });
  return { ok: true };
}
