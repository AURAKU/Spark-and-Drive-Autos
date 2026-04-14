"use server";

import { revalidatePath } from "next/cache";

import { safeAuth } from "@/lib/safe-auth";
import { prisma } from "@/lib/prisma";

export async function markNotificationRead(notificationId: string): Promise<void> {
  const session = await safeAuth();
  if (!session?.user?.id) return;
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: session.user.id },
    data: { read: true },
  });
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function markAllNotificationsRead(): Promise<void> {
  const session = await safeAuth();
  if (!session?.user?.id) return;
  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function deleteNotification(notificationId: string): Promise<void> {
  const session = await safeAuth();
  if (!session?.user?.id) return;
  await prisma.notification.deleteMany({
    where: { id: notificationId, userId: session.user.id },
  });
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function clearAllNotifications(): Promise<void> {
  const session = await safeAuth();
  if (!session?.user?.id) return;
  await prisma.notification.deleteMany({
    where: { userId: session.user.id },
  });
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
  revalidatePath("/");
}
