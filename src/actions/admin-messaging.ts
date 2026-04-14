"use server";

import { MessageSenderType } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createThreadMessage } from "@/lib/chat-service";
import { isSupportStaffRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";
import { sanitizePlainText } from "@/lib/sanitize";

export type SendPrivateMessageResult = { ok: true; threadId?: string } | { ok: false; error: string };

/**
 * Staff-initiated direct message: creates a Live Support thread + first admin message,
 * and notifies the user (bell) with a deep link to the conversation.
 */
export async function sendPrivateUserMessage(
  userId: string,
  title: string,
  body: string,
): Promise<SendPrivateMessageResult> {
  const session = await safeAuth();
  if (!session?.user?.id || !isSupportStaffRole(session.user.role)) {
    return { ok: false, error: "Unauthorized" };
  }

  const safeUserId = sanitizePlainText(userId, 80);
  const t = sanitizePlainText(title, 160);
  const b = sanitizePlainText(body, 4000);
  if (!safeUserId || !t || !b) {
    return { ok: false, error: "User, title and message are required." };
  }

  const user = await prisma.user.findUnique({
    where: { id: safeUserId },
    select: { id: true },
  });
  if (!user) {
    return { ok: false, error: "User not found." };
  }

  const thread = await prisma.chatThread.create({
    data: {
      customerId: user.id,
      subject: t,
    },
  });

  await createThreadMessage({
    threadId: thread.id,
    body: b,
    senderType: MessageSenderType.ADMIN,
    senderUserId: session.user.id,
    attachments: [],
    notifyCustomer: {
      title: t,
      body: b.slice(0, 160),
      href: `/chat?threadId=${thread.id}`,
    },
  });

  revalidatePath("/admin/comms");
  return { ok: true, threadId: thread.id };
}
