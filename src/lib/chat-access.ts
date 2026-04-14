import type { ChatThread } from "@prisma/client";

import { auth } from "@/auth";
import { isSupportStaffRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export type ChatViewer = "admin" | "customer" | "guest";

/**
 * Returns how the current request may access a thread, or null if forbidden.
 */
export async function getChatThreadAccess(
  thread: Pick<ChatThread, "id" | "customerId" | "guestToken">,
  guestCookie: string | undefined
): Promise<ChatViewer | null> {
  const session = await auth();
  if (session?.user?.id && isSupportStaffRole(session.user.role)) {
    return "admin";
  }
  if (thread.customerId && session?.user?.id === thread.customerId) {
    return "customer";
  }
  if (!thread.customerId && thread.guestToken && guestCookie === thread.guestToken) {
    return "guest";
  }
  return null;
}

export async function findThreadOrThrow(threadId: string) {
  const thread = await prisma.chatThread.findUnique({ where: { id: threadId } });
  if (!thread) return null;
  return thread;
}
