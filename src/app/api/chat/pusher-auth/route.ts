import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { findThreadOrThrow, getChatThreadAccess } from "@/lib/chat-access";
import { parseThreadIdFromChannelName } from "@/lib/chat-realtime";
import { getPusherServer } from "@/lib/pusher-server";

/**
 * Pusher private channel authentication.
 * Subscribes only if the caller may access the thread (customer, guest cookie, or support staff).
 */
export async function POST(req: Request) {
  const pusher = getPusherServer();
  if (!pusher) {
    return NextResponse.json({ error: "Pusher not configured" }, { status: 503 });
  }

  let socketId = "";
  let channelName = "";

  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      socketId = params.get("socket_id") ?? "";
      channelName = params.get("channel_name") ?? "";
    } else {
      const raw = await req.json().catch(() => null);
      const parsed = z
        .object({
          socket_id: z.string().min(1),
          channel_name: z.string().min(1),
        })
        .safeParse(raw);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
      }
      socketId = parsed.data.socket_id;
      channelName = parsed.data.channel_name;
    }
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!socketId || !channelName) {
    return NextResponse.json({ error: "socket_id and channel_name required" }, { status: 400 });
  }

  const threadIdRaw = parseThreadIdFromChannelName(channelName);
  const threadId = threadIdRaw ? z.string().cuid().safeParse(threadIdRaw) : null;
  if (!threadId?.success) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }

  const thread = await findThreadOrThrow(threadId.data);
  if (!thread) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cookieStore = await cookies();
  const guest = cookieStore.get("sda_guest")?.value;
  const access = await getChatThreadAccess(thread, guest);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const auth = pusher.authorizeChannel(socketId, channelName);
    return NextResponse.json(auth);
  } catch (e) {
    console.error("[pusher-auth]", e);
    return NextResponse.json({ error: "Auth failed" }, { status: 500 });
  }
}
