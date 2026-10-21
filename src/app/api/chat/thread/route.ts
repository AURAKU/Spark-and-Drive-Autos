import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { resolveActivePublicThread } from "@/lib/live-support-session";
import { isSupportStaffRole } from "@/lib/roles";
import { safeAuth } from "@/lib/safe-auth";

export const runtime = "nodejs";

/** Latest open, still-active live-support thread for this signed-in customer or guest cookie only. */
export async function GET() {
  const session = await safeAuth();
  const userId = session?.user?.id ?? null;
  const isStaff = Boolean(userId && isSupportStaffRole(session?.user?.role));

  if (isStaff) {
    return NextResponse.json({ threadId: null });
  }

  if (userId) {
    const thread = await resolveActivePublicThread({ customerId: userId });
    return NextResponse.json({ threadId: thread?.id ?? null });
  }

  const cookieStore = await cookies();
  const guestToken = cookieStore.get("sda_guest")?.value;
  if (!guestToken) {
    return NextResponse.json({ threadId: null });
  }

  const thread = await resolveActivePublicThread({ guestToken });
  return NextResponse.json({ threadId: thread?.id ?? null });
}
