"use server";

import { NotificationType } from "@prisma/client";

import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/sanitize";

export type NotifyCarRequestResult = { ok: true } | { ok: false; error: string };

/**
 * Sends an in-app notification to the customer linked to this sourcing request
 * (registered user on the request, or a user account with the same email as the guest).
 */
export async function notifyCarRequestCustomer(
  carRequestId: string,
  message: string,
): Promise<NotifyCarRequestResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const body = sanitizePlainText(message, 4000);
  if (!body || body.length < 3) {
    return { ok: false, error: "Message must be at least a few characters." };
  }

  const cr = await prisma.carRequest.findUnique({
    where: { id: carRequestId },
    select: { id: true, userId: true, guestEmail: true, brand: true, model: true },
  });
  if (!cr) {
    return { ok: false, error: "Request not found." };
  }

  let userId = cr.userId;
  if (!userId) {
    const u = await prisma.user.findUnique({
      where: { email: cr.guestEmail.toLowerCase() },
      select: { id: true },
    });
    userId = u?.id ?? null;
  }

  if (!userId) {
    return {
      ok: false,
      error:
        "No customer account is linked. They can register with the same email as this request to receive in-app updates.",
    };
  }

  await prisma.notification.create({
    data: {
      userId,
      type: NotificationType.INQUIRY,
      title: `Update: ${cr.brand} ${cr.model}`,
      body: body.slice(0, 2000),
            href: "/dashboard/inquiry-requests#sourcing",
    },
  });

  return { ok: true };
}
