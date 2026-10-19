import { NextResponse } from "next/server";

import { getRequestIp } from "@/lib/client-ip";
import { rateLimitForm } from "@/lib/rate-limit";
import { safeAuth } from "@/lib/safe-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const rl = await rateLimitForm(`verify-upload:${ip}`);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many upload attempts. Please wait and try again." }, { status: 429 });
  }

  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      error:
        "Passport, driver's licence, and selfie identity photos are not accepted. This shop does not store those images.",
    },
    { status: 400 },
  );
}
