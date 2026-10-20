import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { claimThreadForStaff, releaseThreadToAssistant, threadAssistantState } from "@/lib/live-support-auto-reply";
import { pushChatThreadMessage } from "@/lib/pusher-server";
import { isSupportStaffRole } from "@/lib/roles";

export const runtime = "nodejs";

const schema = z.object({
  action: z.enum(["claim", "release"]),
});

type RouteContext = { params: Promise<{ threadId: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || !isSupportStaffRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await ctx.params;
  if (!threadId) {
    return NextResponse.json({ error: "threadId required" }, { status: 400 });
  }

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

  const state = await threadAssistantState(threadId);
  if (!state) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.action === "claim") {
    await claimThreadForStaff(threadId, session.user.id);
  } else {
    await releaseThreadToAssistant(threadId);
  }

  await pushChatThreadMessage(threadId, { action: "thread_meta", threadId });
  const next = await threadAssistantState(threadId);
  return NextResponse.json({
    ok: true,
    adminId: next?.adminId ?? null,
    assistantActive: Boolean(next?.assistantActive),
  });
}
