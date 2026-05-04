import {
  AvailabilityStatus,
  CarListingState,
  OrderKind,
  OrderStatus,
  PaymentStatus,
  PaymentType,
  OrderBalanceStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

function revalidateCarPaths(slug: string) {
  revalidatePath("/inventory");
  revalidatePath("/");
  revalidatePath(`/cars/${slug}`);
  revalidatePath("/admin/deposit-balances");
}

/** Admin confirms remaining balance received offline — completes sale like full Paystack payment. */
export async function markVehicleDepositBalancePaidAdmin(params: {
  orderId: string;
  adminUserId: string;
  note?: string | null;
  manualReference?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const order = await prisma.order.findFirst({
    where: {
      id: params.orderId,
      kind: OrderKind.CAR,
      paymentType: PaymentType.RESERVATION_DEPOSIT,
    },
    include: { car: true },
  });
  if (!order || !order.carId || !order.car) {
    return { ok: false, error: "ORDER_NOT_FOUND_OR_NOT_DEPOSIT" };
  }
  if (order.orderStatus === OrderStatus.CANCELLED) {
    return { ok: false, error: "ORDER_CANCELLED" };
  }

  const prevNote = order.balanceCollectionNote?.trim() ?? "";
  const stamp = `[${new Date().toISOString()}] Balance marked paid by admin.`;
  const refLine = params.manualReference?.trim() ? ` Ref: ${params.manualReference.trim()}.` : "";
  const noteLine = params.note?.trim() ? ` ${params.note.trim()}` : "";
  const mergedNote = [prevNote, `${stamp}${refLine}${noteLine}`.trim()].filter(Boolean).join("\n\n");

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        orderStatus: OrderStatus.PAID,
        remainingBalance: 0,
        balanceStatus: OrderBalanceStatus.PAID,
        balanceDueAt: null,
        followUpRequired: false,
        balanceCollectionNote: mergedNote || null,
        manualBalancePaymentRef: params.manualReference?.trim() || order.manualBalancePaymentRef,
        balanceMarkedPaidAt: new Date(),
        balanceMarkedPaidById: params.adminUserId,
      },
    });
    await tx.car.updateMany({
      where: {
        id: order.carId!,
        OR: [
          { listingState: { not: CarListingState.SOLD } },
          { availabilityStatus: { not: AvailabilityStatus.SOLD } },
        ],
      },
      data: {
        listingState: CarListingState.SOLD,
        availabilityStatus: AvailabilityStatus.SOLD,
        featured: false,
      },
    });
    await writeAuditLog(
      {
        actorId: params.adminUserId,
        action: "DEPOSIT_BALANCE_MARKED_PAID",
        entityType: "Order",
        entityId: order.id,
        metadataJson: {
          manualReference: params.manualReference ?? null,
          note: params.note ?? null,
        },
      },
      tx,
    );
  });

  revalidateCarPaths(order.car.slug);
  return { ok: true };
}

/** Admin cancels reservation — does not delete order or payments; releases inventory when safe. */
export async function cancelVehicleDepositReservationAdmin(params: {
  orderId: string;
  adminUserId: string;
  reason?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const order = await prisma.order.findFirst({
    where: {
      id: params.orderId,
      kind: OrderKind.CAR,
      paymentType: PaymentType.RESERVATION_DEPOSIT,
    },
    include: { car: true },
  });
  if (!order || !order.carId || !order.car) {
    return { ok: false, error: "ORDER_NOT_FOUND_OR_NOT_DEPOSIT" };
  }
  if (order.orderStatus === OrderStatus.CANCELLED) {
    return { ok: false, error: "ALREADY_CANCELLED" };
  }
  if (order.orderStatus === OrderStatus.PAID && Number(order.remainingBalance ?? 0) <= 0) {
    return { ok: false, error: "ORDER_ALREADY_FULLY_PAID" };
  }

  const prevNote = order.balanceCollectionNote?.trim() ?? "";
  const stamp = `[${new Date().toISOString()}] Reservation cancelled by admin.`;
  const reasonLine = params.reason?.trim() ? ` ${params.reason.trim()}` : "";
  const mergedNote = [prevNote, `${stamp}${reasonLine}`.trim()].filter(Boolean).join("\n\n");

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        orderStatus: OrderStatus.CANCELLED,
        followUpRequired: false,
        balanceCollectionNote: mergedNote || null,
      },
    });

    const otherBlocking = await tx.payment.count({
      where: {
        status: PaymentStatus.SUCCESS,
        order: {
          carId: order.carId!,
          kind: OrderKind.CAR,
          id: { not: order.id },
          orderStatus: { not: OrderStatus.CANCELLED },
        },
      },
    });

    const carRow = order.car;
    if (otherBlocking === 0 && carRow && carRow.availabilityStatus === AvailabilityStatus.RESERVED) {
      await tx.car.updateMany({
        where: {
          id: order.carId!,
          listingState: CarListingState.PUBLISHED,
          availabilityStatus: AvailabilityStatus.RESERVED,
        },
        data: {
          availabilityStatus: AvailabilityStatus.AVAILABLE,
        },
      });
    }

    await writeAuditLog(
      {
        actorId: params.adminUserId,
        action: "DEPOSIT_RESERVATION_CANCELLED",
        entityType: "Order",
        entityId: order.id,
        metadataJson: { reason: params.reason ?? null },
      },
      tx,
    );
  });

  revalidateCarPaths(order.car.slug);
  return { ok: true };
}
