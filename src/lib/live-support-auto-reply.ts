import { ChatThreadStatus, MessageSenderType } from "@prisma/client";

import {
  generateLiveSupportReply,
  isHumanHandlingThread,
  sanitizeAssistantReply,
} from "@/lib/live-support-assistant";
import { createThreadMessage } from "@/lib/chat-service";
import { prisma } from "@/lib/prisma";
import { pushChatThreadMessage } from "@/lib/pusher-server";
import { rateLimitChat } from "@/lib/rate-limit";

const COALESCE_MS = 700;
const REPLY_MIN_GAP_MS = 6_000;
const inFlight = new Set<string>();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function claimThreadForStaff(threadId: string, staffUserId: string) {
  await prisma.chatThread.update({
    where: { id: threadId },
    data: { adminId: staffUserId },
  });
}

export async function releaseThreadToAssistant(threadId: string) {
  await prisma.chatThread.update({
    where: { id: threadId },
    data: { adminId: null },
  });
}

export async function threadAssistantState(threadId: string) {
  const thread = await prisma.chatThread.findUnique({
    where: { id: threadId },
    select: { id: true, adminId: true, status: true },
  });
  if (!thread) return null;
  const lastAdmin = await prisma.message.findFirst({
    where: { chatId: threadId, senderType: MessageSenderType.ADMIN, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const lastAdminAt = lastAdmin?.createdAt ?? null;
  const human = isHumanHandlingThread({ adminId: thread.adminId, lastAdminAt });
  const assistantActive = thread.status === ChatThreadStatus.OPEN && !human;
  return {
    ...thread,
    lastAdminAt,
    assistantActive,
  };
}

/**
 * After a customer message: reply as Spark assistant when no human is on the thread.
 * Safe to fire-and-forget. Never throws to the caller.
 */
export async function maybePostLiveSupportAssistantReply(params: {
  threadId: string;
  triggerMessageId: string;
}): Promise<void> {
  const { threadId } = params;
  if (inFlight.has(threadId)) return;
  inFlight.add(threadId);
  try {
    await delay(COALESCE_MS);
    await postIfEligible(threadId);
    await postIfEligible(threadId);
  } catch (e) {
    console.error("[live-support] auto-reply failed", e);
  } finally {
    inFlight.delete(threadId);
  }
}

async function postIfEligible(threadId: string): Promise<void> {
  const state = await threadAssistantState(threadId);
  if (!state || !state.assistantActive) return;

  const recent = await prisma.message.findMany({
    where: { chatId: threadId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 16,
    include: { attachments: { select: { id: true }, take: 1 } },
  });
  if (recent.length === 0) return;

  const latest = recent[0]!;
  if (latest.senderType !== MessageSenderType.USER) return;

  const alreadyReplied = recent.some(
    (m) =>
      m.senderType === MessageSenderType.SYSTEM &&
      m.createdAt.getTime() >= latest.createdAt.getTime(),
  );
  if (alreadyReplied) return;

  const lastSystem = recent.find((m) => m.senderType === MessageSenderType.SYSTEM);
  if (lastSystem && Date.now() - lastSystem.createdAt.getTime() < REPLY_MIN_GAP_MS) {
    return;
  }

  const userText = latest.body.replace(/\u00a0/g, " ").trim();
  const hasAttachments = latest.attachments.length > 0;
  if (!userText && !hasAttachments) return;

  const rl = await rateLimitChat(`live-support-bot:${threadId}`);
  if (!rl.success) return;

  const chronological = recent.slice().reverse();
  const recentTurns = chronological.map((m) => {
    const text = m.body.replace(/\u00a0/g, " ").trim();
    const role =
      m.senderType === MessageSenderType.USER
        ? ("customer" as const)
        : m.senderType === MessageSenderType.ADMIN
          ? ("team" as const)
          : ("assistant" as const);
    return { role, text };
  });

  const generated = await generateLiveSupportReply({
    userText,
    hasAttachments,
    recentTurns,
  });

  const refreshed = await threadAssistantState(threadId);
  if (!refreshed?.assistantActive) return;
  if (refreshed.adminId && !isHumanHandlingThread({ adminId: refreshed.adminId, lastAdminAt: refreshed.lastAdminAt })) {
    await prisma.chatThread.update({
      where: { id: threadId },
      data: { adminId: null },
    });
  }

  const stillLatest = await prisma.message.findFirst({
    where: { chatId: threadId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, senderType: true },
  });
  if (!stillLatest || stillLatest.senderType !== MessageSenderType.USER) return;
  if (stillLatest.id !== latest.id) return;

  const body = sanitizeAssistantReply(generated.reply);
  const msg = await createThreadMessage({
    threadId,
    body,
    senderType: MessageSenderType.SYSTEM,
    senderUserId: null,
    attachments: [],
    notifyCustomer: null,
  });

  await pushChatThreadMessage(threadId, {
    action: "create",
    threadId,
    id: msg.id,
    body: msg.body,
    createdAt: msg.createdAt,
    senderType: msg.senderType,
  });
}
