"use server";

import { ShipmentLogisticsStage } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/leads";
import { prisma } from "@/lib/prisma";

export type ShippingAdminState = { ok?: boolean; error?: string } | null;

const appendEventSchema = z.object({
  shipmentId: z.string().cuid(),
  stage: z.nativeEnum(ShipmentLogisticsStage),
  title: z.string().min(1).max(200),
  description: z.string().max(8000).optional(),
});

export async function appendShipmentStatusEvent(
  _prev: ShippingAdminState,
  formData: FormData,
): Promise<ShippingAdminState> {
  try {
    const session = await requireAdmin();
    const parsed = appendEventSchema.safeParse({
      shipmentId: formData.get("shipmentId"),
      stage: formData.get("stage"),
      title: formData.get("title"),
      description: formData.get("description") || undefined,
    });
    if (!parsed.success) return { error: "Invalid event payload." };
    const vis = formData.get("visibleToCustomer") != null;
    const ship = await prisma.shipment.findUnique({
      where: { id: parsed.data.shipmentId },
      select: { id: true, orderId: true, order: { select: { userId: true, reference: true } } },
    });
    if (!ship) return { error: "Shipment not found." };

    await prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: ship.id },
        data: { currentStage: parsed.data.stage },
      });
      await tx.shipmentStatusEvent.create({
        data: {
          shipmentId: ship.id,
          stage: parsed.data.stage,
          title: parsed.data.title.trim(),
          description: parsed.data.description?.trim() || null,
          visibleToCustomer: vis,
          createdById: session.user.id,
        },
      });
    });

    if (ship.order.userId) {
      await prisma.notification.create({
        data: {
          userId: ship.order.userId,
          type: "SHIPPING",
          title: "Shipping update",
          body: `${parsed.data.title.trim()} — order ${ship.order.reference}`,
          href: `/dashboard/orders/${ship.orderId}`,
        },
      });
    }

    await auditLog(session.user.id, "shipment.event.append", "Shipment", ship.id, {
      stage: parsed.data.stage,
    });
    revalidatePath("/admin/shipping");
    revalidatePath(`/admin/orders/${ship.orderId}`);
    revalidatePath(`/dashboard/orders/${ship.orderId}`);
    revalidatePath("/dashboard/shipping");
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { error: "Admin only." };
    console.error("[appendShipmentStatusEvent]", e);
    return { error: e instanceof Error ? e.message : "Could not save event." };
  }
}

const updateDetailsSchema = z.object({
  shipmentId: z.string().cuid(),
  feeAmount: z.preprocess((v) => {
    if (v === "" || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }, z.number().nonnegative().optional()),
  estimatedDuration: z.string().max(500).optional(),
  trackingNumber: z.string().max(200).optional(),
  carrier: z.string().max(200).optional(),
  internalNotes: z.string().max(8000).optional(),
});

export async function updateShipmentDetailsAction(
  _prev: ShippingAdminState,
  formData: FormData,
): Promise<ShippingAdminState> {
  try {
    const session = await requireAdmin();
    const parsed = updateDetailsSchema.safeParse({
      shipmentId: formData.get("shipmentId"),
      feeAmount: formData.get("feeAmount"),
      estimatedDuration: formData.get("estimatedDuration") || undefined,
      trackingNumber: formData.get("trackingNumber") || undefined,
      carrier: formData.get("carrier") || undefined,
      internalNotes: formData.get("internalNotes") || undefined,
    });
    if (!parsed.success) return { error: "Invalid details." };
    const ship = await prisma.shipment.findUnique({
      where: { id: parsed.data.shipmentId },
      select: { id: true, orderId: true },
    });
    if (!ship) return { error: "Shipment not found." };

    await prisma.shipment.update({
      where: { id: ship.id },
      data: {
        ...(parsed.data.feeAmount !== undefined ? { feeAmount: parsed.data.feeAmount } : {}),
        ...(parsed.data.estimatedDuration !== undefined
          ? { estimatedDuration: parsed.data.estimatedDuration || null }
          : {}),
        ...(parsed.data.trackingNumber !== undefined ? { trackingNumber: parsed.data.trackingNumber || null } : {}),
        ...(parsed.data.carrier !== undefined ? { carrier: parsed.data.carrier || null } : {}),
        ...(parsed.data.internalNotes !== undefined ? { internalNotes: parsed.data.internalNotes || null } : {}),
      },
    });
    await auditLog(session.user.id, "shipment.details.update", "Shipment", ship.id, {});
    revalidatePath("/admin/shipping");
    revalidatePath(`/admin/orders/${ship.orderId}`);
    revalidatePath(`/dashboard/orders/${ship.orderId}`);
    revalidatePath("/dashboard/shipping");
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { error: "Admin only." };
    console.error("[updateShipmentDetailsAction]", e);
    return { error: "Could not update shipment." };
  }
}

const bulkStageSchema = z.object({
  shipmentIds: z.string().min(3),
  stage: z.nativeEnum(ShipmentLogisticsStage),
  title: z.string().min(1).max(200),
});

export async function bulkTransitionShipmentStage(
  _prev: ShippingAdminState,
  formData: FormData,
): Promise<ShippingAdminState> {
  try {
    const session = await requireAdmin();
    const parsed = bulkStageSchema.safeParse({
      shipmentIds: formData.get("shipmentIds"),
      stage: formData.get("stage"),
      title: formData.get("title"),
    });
    if (!parsed.success) return { error: "Invalid bulk payload." };
    const ids = parsed.data.shipmentIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) return { error: "Select at least one shipment." };

    const shipments = await prisma.shipment.findMany({
      where: { id: { in: ids } },
      select: { id: true, orderId: true, order: { select: { userId: true, reference: true } } },
    });
    if (shipments.length === 0) return { error: "No matching shipments." };

    await prisma.$transaction(async (tx) => {
      for (const s of shipments) {
        await tx.shipment.update({
          where: { id: s.id },
          data: { currentStage: parsed.data.stage },
        });
      }
      await tx.shipmentStatusEvent.createMany({
        data: shipments.map((s) => ({
          shipmentId: s.id,
          stage: parsed.data.stage,
          title: parsed.data.title.trim(),
          description: "Bulk logistics update",
          visibleToCustomer: true,
          createdById: session.user.id,
        })),
      });
    });

    for (const s of shipments) {
      if (!s.order.userId) continue;
      await prisma.notification.create({
        data: {
          userId: s.order.userId,
          type: "SHIPPING",
          title: "Shipping update",
          body: `${parsed.data.title.trim()} — order ${s.order.reference}`,
          href: `/dashboard/orders/${s.orderId}`,
        },
      });
    }

    await auditLog(session.user.id, "shipment.bulk.stage", "Shipment", undefined, {
      count: shipments.length,
      stage: parsed.data.stage,
    });
    revalidatePath("/admin/shipping");
    for (const s of shipments) {
      revalidatePath(`/admin/orders/${s.orderId}`);
      revalidatePath(`/dashboard/orders/${s.orderId}`);
    }
    revalidatePath("/dashboard/shipping");
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { error: "Admin only." };
    console.error("[bulkTransitionShipmentStage]", e);
    return { error: "Bulk update failed." };
  }
}
