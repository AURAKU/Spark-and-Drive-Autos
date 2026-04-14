"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { safeAuth } from "@/lib/safe-auth";
import { isAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { pushChatThreadMessage } from "@/lib/pusher-server";

const blockSchema = z.object({
  userId: z.string().cuid(),
  blocked: z.boolean(),
  threadId: z.string().cuid().optional(),
});

export type BlockResult = { ok: true } | { ok: false; error: string };

export async function setUserMessagingBlocked(
  userId: string,
  blocked: boolean,
  threadId?: string,
): Promise<BlockResult> {
  const session = await safeAuth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return { ok: false, error: "Unauthorized" };
  }
  const parsed = blockSchema.safeParse({ userId, blocked, threadId });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }
  const u = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true } });
  if (!u) {
    return { ok: false, error: "User not found" };
  }
  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { messagingBlocked: parsed.data.blocked },
  });
  revalidatePath("/admin/comms");
  if (parsed.data.threadId) {
    await pushChatThreadMessage(parsed.data.threadId, { action: "thread_meta", threadId: parsed.data.threadId });
  }
  return { ok: true };
}
