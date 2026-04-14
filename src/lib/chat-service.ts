import { AttachmentKind, MessageSenderType, MessageType, NotificationType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type AttachmentInput = {
  url: string;
  publicId?: string | null;
  kind: AttachmentKind;
  mimeType?: string | null;
  durationSec?: number | null;
};

function resolveMessageType(attachments: AttachmentInput[]): MessageType {
  if (attachments.length === 0) return MessageType.TEXT;
  const k = attachments[0]!.kind;
  if (attachments.every((a) => a.kind === k)) {
    if (k === AttachmentKind.IMAGE) return MessageType.IMAGE;
    if (k === AttachmentKind.VIDEO) return MessageType.VIDEO;
    if (k === AttachmentKind.AUDIO) return MessageType.AUDIO;
  }
  return MessageType.FILE;
}

export async function createThreadMessage(params: {
  threadId: string;
  body: string;
  senderType: MessageSenderType;
  senderUserId: string | null;
  attachments: AttachmentInput[];
  /** When set, overrides default bell notification for admin → customer replies. */
  notifyCustomer?: { title: string; body: string; href: string } | null;
}) {
  const thread = await prisma.chatThread.findUnique({
    where: { id: params.threadId },
    select: { id: true, customerId: true, subject: true },
  });
  if (!thread) {
    throw new Error("THREAD_NOT_FOUND");
  }

  if (params.senderType === MessageSenderType.USER && params.senderUserId) {
    const u = await prisma.user.findUnique({
      where: { id: params.senderUserId },
      select: { messagingBlocked: true },
    });
    if (u?.messagingBlocked) {
      throw new Error("USER_MESSAGING_BLOCKED");
    }
  }

  const trimmed = params.body.trim();
  const body =
    trimmed || (params.attachments.length > 0 ? "\u00a0" : "");
  if (!trimmed && params.attachments.length === 0) {
    throw new Error("EMPTY_MESSAGE");
  }

  const messageType = resolveMessageType(params.attachments);

  const msg = await prisma.message.create({
    data: {
      chatId: params.threadId,
      body: body || " ",
      messageType,
      senderType: params.senderType,
      senderUserId: params.senderUserId,
      attachments:
        params.attachments.length > 0
          ? {
              create: params.attachments.map((a, i) => ({
                url: a.url,
                publicId: a.publicId ?? undefined,
                kind: a.kind,
                mimeType: a.mimeType ?? undefined,
                durationSec: a.durationSec ?? undefined,
                sortOrder: i,
              })),
            }
          : undefined,
    },
    include: {
      attachments: { orderBy: { sortOrder: "asc" } },
      sender: { select: { id: true, name: true, email: true, image: true, role: true } },
    },
  });

  const fromUser = params.senderType === MessageSenderType.USER;
  await prisma.chatThread.update({
    where: { id: thread.id },
    data: {
      lastMessageAt: new Date(),
      ...(fromUser
        ? { unreadForAdmin: { increment: 1 } }
        : { unreadForCustomer: { increment: 1 } }),
    },
  });

  // Customer bell notifications: every admin reply in an authenticated thread appears in Notifications.
  if (
    params.senderType === MessageSenderType.ADMIN &&
    thread.customerId &&
    params.senderUserId !== thread.customerId &&
    params.notifyCustomer !== null
  ) {
    const n = params.notifyCustomer;
    await prisma.notification.create({
      data: {
        userId: thread.customerId,
        type: NotificationType.CHAT,
        title: n?.title ?? "New message from Spark and Drive Autos",
        body: n?.body ?? (trimmed ? trimmed.slice(0, 160) : "You received a new message in your chat thread."),
        href: n?.href ?? "/dashboard/chats",
      },
    });
  }

  return msg;
}

export async function markThreadReadForViewer(threadId: string, viewer: "admin" | "customer" | "guest") {
  if (viewer === "admin") {
    await prisma.$transaction([
      prisma.chatThread.update({
        where: { id: threadId },
        data: { unreadForAdmin: 0 },
      }),
      prisma.message.updateMany({
        where: { chatId: threadId, senderType: MessageSenderType.USER },
        data: { isRead: true, readAt: new Date() },
      }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.chatThread.update({
        where: { id: threadId },
        data: { unreadForCustomer: 0 },
      }),
      prisma.message.updateMany({
        where: { chatId: threadId, senderType: MessageSenderType.ADMIN },
        data: { isRead: true, readAt: new Date() },
      }),
    ]);
  }
}

export function attachmentKindFromMime(mime: string): AttachmentKind {
  if (mime.startsWith("image/")) return AttachmentKind.IMAGE;
  if (mime.startsWith("video/")) return AttachmentKind.VIDEO;
  if (mime.startsWith("audio/")) return AttachmentKind.AUDIO;
  return AttachmentKind.FILE;
}

/** Customers may edit only within this window; staff may edit anytime. */
const EDIT_WINDOW_MS = 60_000;

export async function editThreadMessage(params: {
  messageId: string;
  body: string;
  actorUserId: string;
  isStaff: boolean;
}) {
  const msg = await prisma.message.findUnique({
    where: { id: params.messageId },
    select: { id: true, chatId: true, senderUserId: true, deletedAt: true, createdAt: true },
  });
  if (!msg || msg.deletedAt) {
    throw new Error("MESSAGE_NOT_FOUND");
  }
  if (!params.isStaff && msg.senderUserId !== params.actorUserId) {
    throw new Error("FORBIDDEN");
  }
  if (!params.isStaff && Date.now() - msg.createdAt.getTime() > EDIT_WINDOW_MS) {
    throw new Error("EDIT_WINDOW_EXPIRED");
  }
  const trimmed = params.body.trim();
  if (!trimmed) {
    throw new Error("EMPTY_MESSAGE");
  }
  return prisma.message.update({
    where: { id: msg.id },
    data: { body: trimmed, editedAt: new Date() },
    include: {
      attachments: { orderBy: { sortOrder: "asc" } },
      sender: { select: { id: true, name: true, email: true, image: true, role: true } },
    },
  });
}

/** Only admins may delete messages (soft delete). */
export async function softDeleteThreadMessage(params: {
  messageId: string;
  actorUserId: string;
  actorIsAdmin: boolean;
}) {
  const msg = await prisma.message.findUnique({
    where: { id: params.messageId },
    select: { id: true, senderUserId: true, deletedAt: true },
  });
  if (!msg || msg.deletedAt) {
    throw new Error("MESSAGE_NOT_FOUND");
  }
  if (!params.actorIsAdmin) {
    throw new Error("FORBIDDEN");
  }
  return prisma.message.update({
    where: { id: msg.id },
    data: { deletedAt: new Date() },
    include: {
      attachments: { orderBy: { sortOrder: "asc" } },
      sender: { select: { id: true, name: true, email: true, image: true, role: true } },
    },
  });
}
