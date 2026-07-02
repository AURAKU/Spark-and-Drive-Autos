import { AvailabilityStatus, CarListingState, OrderStatus, PaymentStatus, PaymentType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function motorcycleHasSuccessfulFullPayment(motorcycleId: string): Promise<boolean> {
  const order = await prisma.order.findFirst({
    where: {
      motorcycleId,
      kind: "MOTORCYCLE",
      orderStatus: { in: [OrderStatus.PAID, OrderStatus.DELIVERED] },
      payments: { some: { status: PaymentStatus.SUCCESS, paymentType: PaymentType.FULL } },
    },
    select: { id: true },
  });
  return order != null;
}

export async function syncMotorcycleInventoryAfterSuccessfulPayment(paymentId: string): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      paymentType: true,
      status: true,
      order: {
        select: {
          motorcycleId: true,
          kind: true,
          orderStatus: true,
        },
      },
    },
  });
  if (!payment?.order?.motorcycleId || payment.order.kind !== "MOTORCYCLE") return;
  if (payment.status !== PaymentStatus.SUCCESS) return;

  const motorcycleId = payment.order.motorcycleId;

  if (payment.paymentType === PaymentType.FULL) {
    await prisma.motorcycle.update({
      where: { id: motorcycleId },
      data: {
        listingState: CarListingState.SOLD,
        availabilityStatus: AvailabilityStatus.SOLD,
      },
    });
  } else if (payment.paymentType === PaymentType.RESERVATION_DEPOSIT) {
    await prisma.motorcycle.update({
      where: { id: motorcycleId },
      data: {
        availabilityStatus: AvailabilityStatus.RESERVED,
      },
    });
  }
}
