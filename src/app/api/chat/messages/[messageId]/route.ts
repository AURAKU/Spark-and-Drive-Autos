import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { findThreadOrThrow, getChatThreadAccess } from "@/lib/chat-access";
import { editThreadMessage, softDeleteThreadMessage } from "@/lib/chat-service";
import { isAdminRole, isSupportStaffRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { pushChatThreadMessage } from "@/lib/pusher-server";
import { rateLimitChatModeration } from "@/lib/rate-limit";
import { sanitizePlainText } from "@/lib/sanitize";
import { cookies } from "next/headers";

const patchSchema = z.object({
  body: z.string().min(1).max(8000),
});

type RouteContext = { params: Promise<{ messageId: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  const { messageId } = await ctx.params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rlPatch = await rateLimitChatModeration(`mod:${session.user.id}:${ip}`);
  if (!rlPatch.success) {
    return NextResponse.json({ error: "Slow down." }, { status: 429 });
  }

  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, chatId: true },
  });
  if (!msg) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isStaff = isSupportStaffRole(session.user.role);
  const cookieStore = await cookies();
  const guest = cookieStore.get("sda_guest")?.value;
  const thread = await findThreadOrThrow(msg.chatId);
  if (!thread) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const access = await getChatThreadAccess(thread, guest);
  if (!access && !isStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const text = sanitizePlainText(parsed.data.body, 8000);
  try {
    const updated = await editThreadMessage({
      messageId: msg.id,
      body: text,
      actorUserId: session.user.id,
      isStaff,
    });
    await pushChatThreadMessage(msg.chatId, { action: "edit", id: updated.id, threadId: msg.chatId });
    return NextResponse.json({ message: updated });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (e instanceof Error && e.message === "EDIT_WINDOW_EXPIRED") {
      return NextResponse.json({ error: "Edit window expired (1 minute)." }, { status: 403 });
    }
    if (e instanceof Error && e.message === "MESSAGE_NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[chat message PATCH]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: RouteContext) {
  const { messageId } = await ctx.params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimitChatModeration(`del:${session.user.id}:${ip}`);
  if (!rl.success) {
    return NextResponse.json({ error: "Slow down." }, { status: 429 });
  }

  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, chatId: true },
  });
  if (!msg) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isStaff = isSupportStaffRole(session.user.role);
  const isAdmin = isAdminRole(session.user.role);
  const cookieStore = await cookies();
  const guest = cookieStore.get("sda_guest")?.value;
  const thread = await findThreadOrThrow(msg.chatId);
  if (!thread) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const access = await getChatThreadAccess(thread, guest);
  if (!access && !isStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const updated = await softDeleteThreadMessage({
      messageId: msg.id,
      actorUserId: session.user.id,
      actorIsAdmin: isAdmin,
    });
    await pushChatThreadMessage(msg.chatId, { action: "delete", id: updated.id, threadId: msg.chatId });
    return NextResponse.json({ message: updated });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (e instanceof Error && e.message === "MESSAGE_NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[chat message DELETE]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
