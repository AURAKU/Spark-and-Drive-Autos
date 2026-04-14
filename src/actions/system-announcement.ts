"use server";

import { NotificationType } from "@prisma/client";

import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/sanitize";

export type BroadcastResult = { ok: true; count: number } | { ok: false; error: string };

/** In-app system notice to all registered users (for ops / product news). Persists an audit row + per-user notifications. */
export async function broadcastSystemAnnouncement(title: string, body: string): Promise<BroadcastResult> {
  let session: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    session = await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const t = sanitizePlainText(title, 160);
  const b = body ? sanitizePlainText(body, 4000) : null;
  if (!t || t.length < 3) {
    return { ok: false, error: "Title is required." };
  }

  const users = await prisma.user.findMany({
    select: { id: true },
  });
  if (users.length === 0) {
    return { ok: false, error: "No user accounts found." };
  }

  const count = users.length;
  const createdById = session.user.id;

  await prisma.$transaction(async (tx) => {
    await tx.systemAnnouncement.create({
      data: {
        title: t,
        body: b,
        recipientCount: count,
        createdById,
      },
    });
    await tx.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        type: NotificationType.SYSTEM,
        title: t,
        body: b,
        href: "/dashboard/notifications",
      })),
    });
  });

  return { ok: true, count };
}
