import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminRole } from "@/auth";
import { safeAuth } from "@/lib/safe-auth";
import { VIEW_MODE_COOKIE } from "@/lib/view-mode";

const schema = z.object({
  mode: z.enum(["admin", "user"]),
});

/**
 * Full admins only: toggle customer preview vs admin-first navigation (session / RBAC unchanged).
 * Service assistants use the support inbox directly — preview mode is not applicable.
 */
export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const jar = await cookies();
  jar.set(VIEW_MODE_COOKIE, parsed.data.mode, {
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
    sameSite: "lax",
  });

  return NextResponse.json({ ok: true, mode: parsed.data.mode });
}
