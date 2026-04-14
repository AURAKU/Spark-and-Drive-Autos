import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { findThreadOrThrow, getChatThreadAccess } from "@/lib/chat-access";
import { markThreadReadForViewer } from "@/lib/chat-service";

const schema = z.object({ threadId: z.string().cuid() });

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const thread = await findThreadOrThrow(parsed.data.threadId);
  if (!thread) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cookieStore = await cookies();
  const guest = cookieStore.get("sda_guest")?.value;
  const access = await getChatThreadAccess(thread, guest);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await markThreadReadForViewer(parsed.data.threadId, access);
  return NextResponse.json({ ok: true });
}
