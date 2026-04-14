import { AttachmentKind, MessageSenderType } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getRequestIp } from "@/lib/client-ip";
import { findThreadOrThrow, getChatThreadAccess } from "@/lib/chat-access";
import { createThreadMessage } from "@/lib/chat-service";
import { isSupportStaffRole } from "@/lib/roles";
import { safeAuth } from "@/lib/safe-auth";
import { ensureLead } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { pushChatThreadMessage } from "@/lib/pusher-server";
import { rateLimitChat } from "@/lib/rate-limit";
import { assertChatAttachmentsSafe } from "@/lib/chat-attachments";
import { sanitizePlainText } from "@/lib/sanitize";
import { recordSecurityObservation } from "@/lib/security-observation";

const attachmentSchema = z.object({
  url: z.string().url(),
  publicId: z.string().max(500).optional().nullable(),
  kind: z.nativeEnum(AttachmentKind),
  mimeType: z.string().max(120).optional().nullable(),
  durationSec: z.number().int().min(0).optional().nullable(),
});

const postSchema = z
  .object({
    threadId: z.string().cuid().optional(),
    body: z.string().max(8000).optional().default(""),
    attachments: z.array(attachmentSchema).max(8).optional().default([]),
    guestName: z.string().max(120).optional(),
    guestEmail: z.string().email().optional(),
    carId: z.string().cuid().optional(),
  })
  .refine((d) => d.body.trim().length > 0 || d.attachments.length > 0, {
    message: "Message or attachment required",
  });

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const userAgent = req.headers.get("user-agent");
  const rl = await rateLimitChat(`msg:${ip}`);
  if (!rl.success) {
    await recordSecurityObservation({
      severity: "MEDIUM",
      channel: "RATE_LIMIT",
      title: "Chat message send rate-limited",
      ipAddress: ip,
      userAgent,
      path: "/api/chat/messages",
      metadataJson: { scope: "chat:post" },
    });
    return NextResponse.json({ error: "Slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const session = await auth();
  const cookieStore = await cookies();
  const guestCookie = cookieStore.get("sda_guest")?.value;
  const isStaff = Boolean(session?.user?.id && isSupportStaffRole(session.user.role));

  if (!isStaff && !session?.user?.id) {
    return NextResponse.json({ error: "Sign in to use live support chat." }, { status: 401 });
  }
  const customerId = session!.user!.id;

  const data = parsed.data;
  const text = sanitizePlainText(data.body, 8000);

  let threadId = data.threadId;

  if (threadId) {
    const existing = await findThreadOrThrow(threadId);
    if (!existing) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }
    const access = await getChatThreadAccess(existing, guestCookie);
    if (!access) {
      await recordSecurityObservation({
        severity: "MEDIUM",
        channel: "API",
        title: "Chat message rejected (thread access denied)",
        detail: "Caller lacked thread access (wrong guest cookie or wrong user).",
        userId: session?.user?.id ?? null,
        ipAddress: ip,
        userAgent,
        path: "/api/chat/messages",
        metadataJson: { threadId: data.threadId },
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    if (isStaff) {
      return NextResponse.json({ error: "Admin replies require threadId" }, { status: 400 });
    }

    const lead = await ensureLead({ customerId: customerId, sourceChannel: "CHAT", title: "Chat" });

    const thread = await prisma.chatThread.create({
      data: {
        customerId,
        guestToken: null,
        subject: "Customer Service chat",
        carId: data.carId,
        leadId: lead?.id,
      },
    });
    threadId = thread.id;
  }

  const senderType = isStaff ? MessageSenderType.ADMIN : MessageSenderType.USER;
  const senderUserId = customerId;

  try {
    assertChatAttachmentsSafe(
      data.attachments.map((a) => ({
        url: a.url,
        publicId: a.publicId,
        kind: a.kind,
        mimeType: a.mimeType,
        durationSec: a.durationSec,
      })),
    );
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "ATTACHMENT_LIMIT") {
      return NextResponse.json({ error: "Too many attachments (max 8)." }, { status: 400 });
    }
    if (code === "ATTACHMENT_URL_FORBIDDEN") {
      return NextResponse.json({ error: "Invalid attachment URL." }, { status: 400 });
    }
    if (code === "ATTACHMENT_MIME_MISMATCH") {
      return NextResponse.json({ error: "Attachment type does not match file kind." }, { status: 400 });
    }
    throw e;
  }

  try {
    const msg = await createThreadMessage({
      threadId: threadId!,
      body: text,
      senderType,
      senderUserId,
      attachments: data.attachments.map((a) => ({
        url: a.url,
        publicId: a.publicId,
        kind: a.kind,
        mimeType: a.mimeType,
        durationSec: a.durationSec ?? undefined,
      })),
    });

    await pushChatThreadMessage(threadId!, {
      action: "create",
      threadId: threadId!,
      id: msg.id,
      body: msg.body,
      createdAt: msg.createdAt,
      senderType: msg.senderType,
    });

    const res = NextResponse.json({
      threadId,
      messageId: msg.id,
      message: msg,
    });
    return res;
  } catch (e) {
    if (e instanceof Error && e.message === "EMPTY_MESSAGE") {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }
    if (e instanceof Error && e.message === "USER_MESSAGING_BLOCKED") {
      return NextResponse.json({ error: "Messaging is disabled for this account." }, { status: 403 });
    }
    console.error("[chat/messages POST]", e);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const threadId = url.searchParams.get("threadId");
  if (!threadId) {
    return NextResponse.json({ error: "threadId required" }, { status: 400 });
  }

  const session = await safeAuth();
  const cookieStore = await cookies();
  const guest = cookieStore.get("sda_guest")?.value;

  const thread = await prisma.chatThread.findUnique({
    where: { id: threadId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          phone: true,
          messagingBlocked: true,
          role: true,
        },
      },
      car: { select: { id: true, title: true, slug: true } },
      inquiry: { select: { id: true, type: true, status: true, guestPhone: true } },
      carRequest: { select: { id: true, guestPhone: true } },
      lead: { select: { id: true, title: true, stage: true } },
      quote: { select: { id: true, status: true, totalEstimate: true, currency: true } },
    },
  });
  if (!thread) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isStaffViewer = session?.user?.id && isSupportStaffRole(session.user.role);
  if (isStaffViewer) {
    // staff can load any thread
  } else {
    const access = await getChatThreadAccess(thread, guest);
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const limitParam = url.searchParams.get("limit");
  const beforeParam = url.searchParams.get("before");
  const limit = Math.min(400, Math.max(1, parseInt(limitParam ?? "80", 10) || 80));

  let messages;
  if (beforeParam) {
    const beforeMsg = await prisma.message.findFirst({
      where: { id: beforeParam, chatId: threadId },
      select: { createdAt: true },
    });
    if (!beforeMsg) {
      return NextResponse.json({ error: "Invalid before cursor" }, { status: 400 });
    }
    const older = await prisma.message.findMany({
      where: { chatId: threadId, createdAt: { lt: beforeMsg.createdAt } },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        attachments: { orderBy: { sortOrder: "asc" } },
        sender: { select: { id: true, name: true, email: true, image: true, role: true } },
      },
    });
    messages = older.slice().reverse();
  } else {
    messages = await prisma.message.findMany({
      where: { chatId: threadId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        attachments: { orderBy: { sortOrder: "asc" } },
        sender: { select: { id: true, name: true, email: true, image: true, role: true } },
      },
    });
    messages = messages.slice().reverse();
  }

  const oldest = messages[0];
  const hasMore =
    oldest != null
      ? (await prisma.message.count({
          where: { chatId: threadId, createdAt: { lt: oldest.createdAt } },
        })) > 0
      : false;

  const guestPhone =
    thread.inquiry?.guestPhone ?? thread.carRequest?.guestPhone ?? null;

  return NextResponse.json({
    thread: {
      id: thread.id,
      subject: thread.subject,
      status: thread.status,
      lastMessageAt: thread.lastMessageAt,
      unreadForAdmin: thread.unreadForAdmin,
      unreadForCustomer: thread.unreadForCustomer,
      guestName: thread.guestName,
      guestEmail: thread.guestEmail,
      guestPhone,
      customerId: thread.customerId,
      inquiryId: thread.inquiryId,
      customer: thread.customer
        ? {
            id: thread.customer.id,
            name: thread.customer.name,
            email: thread.customer.email,
            image: thread.customer.image,
            phone: thread.customer.phone,
            ...(isStaffViewer
              ? {
                  messagingBlocked: thread.customer.messagingBlocked,
                  role: thread.customer.role,
                }
              : {}),
            ...(!isStaffViewer && session?.user?.id && thread.customerId === session.user.id
              ? { messagingBlocked: thread.customer.messagingBlocked }
              : {}),
          }
        : null,
      car: thread.car,
      inquiry: thread.inquiry,
      lead: isStaffViewer ? thread.lead : null,
      quote: isStaffViewer ? thread.quote : null,
      carRequest:
        isStaffViewer && thread.carRequest
          ? { id: thread.carRequest.id, guestPhone: thread.carRequest.guestPhone }
          : null,
    },
    messages,
    hasMore,
    oldestMessageId: messages[0]?.id ?? null,
  });
}
