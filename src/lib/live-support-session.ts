import { ChatThreadStatus, type ChatThread } from "@prisma/client";

import { LIVE_SUPPORT_IDLE_MS, isLiveSupportIdleSince } from "@/lib/live-support-idle";
import { prisma } from "@/lib/prisma";

export { LIVE_SUPPORT_IDLE_MS, isLiveSupportIdleSince };

type IdleFields = Pick<ChatThread, "id" | "status" | "lastMessageAt" | "updatedAt">;

export function isLiveSupportIdle(thread: IdleFields, now = new Date()): boolean {
  if (thread.status !== ChatThreadStatus.OPEN) return true;
  return isLiveSupportIdleSince(thread.lastMessageAt ?? thread.updatedAt, now.getTime());
}

const archiveData = {
  status: ChatThreadStatus.ARCHIVED,
  adminId: null,
  guestToken: null,
} as const;

/** Release the guest token unique slot so this visitor can start a new private thread. */
export async function archivePublicChatThread(threadId: string) {
  await prisma.chatThread.update({
    where: { id: threadId },
    data: archiveData,
  });
}

export async function archiveIfIdlePublicThread(thread: IdleFields, now = new Date()): Promise<boolean> {
  if (thread.status !== ChatThreadStatus.OPEN) return true;
  if (!isLiveSupportIdle(thread, now)) return false;
  await archivePublicChatThread(thread.id);
  return true;
}

/** Latest open, still-active thread for this visitor. Idle ones are archived and hidden. */
export async function resolveActivePublicThread(input: {
  customerId?: string | null;
  guestToken?: string | null;
}): Promise<{ id: string } | null> {
  const now = new Date();

  if (input.customerId) {
    const threads = await prisma.chatThread.findMany({
      where: { customerId: input.customerId, status: ChatThreadStatus.OPEN },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      select: { id: true, status: true, lastMessageAt: true, updatedAt: true },
    });
    for (const thread of threads) {
      if (await archiveIfIdlePublicThread(thread, now)) continue;
      return { id: thread.id };
    }
    return null;
  }

  if (!input.guestToken) return null;

  const thread = await prisma.chatThread.findFirst({
    where: { guestToken: input.guestToken, customerId: null, status: ChatThreadStatus.OPEN },
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    select: { id: true, status: true, lastMessageAt: true, updatedAt: true },
  });
  if (!thread) return null;
  if (await archiveIfIdlePublicThread(thread, now)) return null;
  return { id: thread.id };
}

export async function ensurePublicChatThread(input: {
  customerId: string | null;
  guestToken: string | null;
  carId?: string;
  guestName?: string | null;
  guestEmail?: string | null;
  leadId?: string | null;
}): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const now = new Date();

    if (input.customerId) {
      const open = await tx.chatThread.findMany({
        where: { customerId: input.customerId, status: ChatThreadStatus.OPEN },
        orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      });
      for (const thread of open) {
        if (isLiveSupportIdle(thread, now)) {
          await tx.chatThread.update({
            where: { id: thread.id },
            data: { status: ChatThreadStatus.ARCHIVED, adminId: null },
          });
          continue;
        }
        return thread.id;
      }
      const created = await tx.chatThread.create({
        data: {
          customerId: input.customerId,
          guestToken: null,
          subject: "Customer Service chat",
          carId: input.carId,
          leadId: input.leadId ?? undefined,
        },
      });
      return created.id;
    }

    if (!input.guestToken) {
      throw new Error("GUEST_TOKEN_REQUIRED");
    }

    const open = await tx.chatThread.findFirst({
      where: { guestToken: input.guestToken, customerId: null, status: ChatThreadStatus.OPEN },
    });
    if (open) {
      if (!isLiveSupportIdle(open, now)) return open.id;
      await tx.chatThread.update({
        where: { id: open.id },
        data: archiveData,
      });
    }

    const created = await tx.chatThread.create({
      data: {
        customerId: null,
        guestToken: input.guestToken,
        guestName: input.guestName ?? undefined,
        guestEmail: input.guestEmail ?? undefined,
        subject: "Customer Service chat",
        carId: input.carId,
      },
    });
    return created.id;
  });
}
