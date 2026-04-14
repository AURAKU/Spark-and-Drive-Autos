import { NotificationType, PaymentType } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

const SALE_PAYMENT_TYPES: PaymentType[] = [PaymentType.FULL, PaymentType.RESERVATION_DEPOSIT];

const CHUNK = 200;

/**
 * When a payment succeeds (full or deposit), mark the linked vehicle sold and notify every account.
 * Idempotent: if the car is already SOLD, skips updates and notifications.
 */
export async function markCarSoldAndNotifyUsersFromPayment(paymentId: string): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: true },
  });
  if (!payment || payment.status !== "SUCCESS") return;
  if (!SALE_PAYMENT_TYPES.includes(payment.paymentType)) return;
  if (!payment.orderId) return;

  const order = await prisma.order.findUnique({
    where: { id: payment.orderId },
    include: { car: true },
  });
  if (!order?.carId || !order.car) return;

  const car = order.car;
  if (car.listingState === "SOLD") {
    return;
  }

  await prisma.car.update({
    where: { id: car.id },
    data: {
      listingState: "SOLD",
      availabilityStatus: "SOLD",
      featured: false,
    },
  });

  const users = await prisma.user.findMany({ select: { id: true } });
  const title = `Sold: ${car.title}`;
  const body = "This listing is no longer available for purchase.";
  const href = `/cars/${car.slug}`;

  for (let i = 0; i < users.length; i += CHUNK) {
    const slice = users.slice(i, i + CHUNK);
    await prisma.notification.createMany({
      data: slice.map((u) => ({
        userId: u.id,
        type: NotificationType.SYSTEM,
        title,
        body,
        href,
      })),
    });
  }

  revalidatePath("/inventory");
  revalidatePath("/");
  revalidatePath(`/cars/${car.slug}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
}
