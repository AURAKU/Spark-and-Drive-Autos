import {
  AvailabilityStatus,
  CarListingState,
  NotificationType,
  OrderKind,
  PaymentStatus,
  PaymentType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { recordSecurityObservation } from "@/lib/security-observation";

const CHUNK = 200;

const BROADCAST_SOLD_BODY =
  "This vehicle is fully paid and is no longer available for purchase here. Looking for something similar? Contact Spark and Drive Autos support—we’ll help you explore comparable options.";

const BROADCAST_RESERVED_BODY =
  "This listing has been reserved by a buyer completing a purchase. Similar vehicles may be available—contact our support team for details.";

/** True if this vehicle already has a successful payment on a car order (blocks another buyer). */
export async function carHasSuccessfulVehiclePayment(carId: string): Promise<boolean> {
  const row = await prisma.payment.findFirst({
    where: {
      status: PaymentStatus.SUCCESS,
      order: { carId, kind: OrderKind.CAR },
    },
    select: { id: true },
  });
  return row != null;
}

/** Successful full (not deposit-only) vehicle payment — inventory should stay sold unless an admin overrides. */
export async function carHasSuccessfulFullVehiclePayment(carId: string): Promise<boolean> {
  const row = await prisma.payment.findFirst({
    where: {
      status: PaymentStatus.SUCCESS,
      paymentType: PaymentType.FULL,
      order: { carId, kind: OrderKind.CAR },
    },
    select: { id: true },
  });
  return row != null;
}

function revalidateCarInventoryPaths(slug: string) {
  revalidatePath("/inventory");
  revalidatePath("/");
  revalidatePath(`/cars/${slug}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
}

async function broadcastToAllUsers(title: string, body: string, href: string) {
  const users = await prisma.user.findMany({ select: { id: true } });
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
}

/**
 * After a vehicle payment reaches SUCCESS (Paystack webhook/return, or manual after admin approval):
 * - **Reservation deposit** → inventory `RESERVED` (listing stays published; not “sold” until full payment).
 * - **Full payment** → inventory `SOLD` / fully paid.
 *
 * Manual flows only reach SUCCESS after proof + admin confirmation, so inventory updates only then.
 */
export async function syncCarInventoryAfterSuccessfulVehiclePayment(paymentId: string): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: true },
  });
  if (!payment || payment.status !== "SUCCESS") return;
  if (!payment.orderId) return;
  if (payment.paymentType !== PaymentType.FULL && payment.paymentType !== PaymentType.RESERVATION_DEPOSIT) {
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: payment.orderId },
    include: { car: true },
  });
  if (!order?.carId || !order.car || order.kind !== OrderKind.CAR) return;

  const car = order.car;

  if (payment.paymentType === PaymentType.RESERVATION_DEPOSIT) {
    const updated = await prisma.car.updateMany({
      where: {
        id: car.id,
        listingState: CarListingState.PUBLISHED,
        availabilityStatus: AvailabilityStatus.AVAILABLE,
      },
      data: {
        availabilityStatus: AvailabilityStatus.RESERVED,
        featured: false,
      },
    });

    if (updated.count === 0) {
      await recordSecurityObservation({
        severity: "MEDIUM",
        channel: "PAYMENT",
        title: "Reservation deposit success but vehicle was not AVAILABLE to reserve",
        detail: `paymentId=${paymentId} carId=${car.id} availability=${car.availabilityStatus}`,
        path: "syncCarInventoryAfterSuccessfulVehiclePayment",
      });
      return;
    }

    await broadcastToAllUsers(
      `Reserved: ${car.title}`,
      BROADCAST_RESERVED_BODY,
      "/contact",
    );
    revalidateCarInventoryPaths(car.slug);
    return;
  }

  // FULL payment → fully paid / sold (any non–fully-sold row, e.g. published + reserved after deposit)
  const updated = await prisma.car.updateMany({
    where: {
      id: car.id,
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

  revalidateCarInventoryPaths(car.slug);

  if (updated.count === 0) {
    // Already sold — idempotent webhook / return replay
    return;
  }

  await broadcastToAllUsers(`Fully paid: ${car.title}`, BROADCAST_SOLD_BODY, "/contact");
}
