import { VerificationDocumentType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestIp } from "@/lib/client-ip";
import { rateLimitForm } from "@/lib/rate-limit";
import { safeAuth } from "@/lib/safe-auth";

const schema = z.object({
  documentType: z.nativeEnum(VerificationDocumentType),
  reason: z.string().min(4).max(300).optional(),
  documentFrontUrl: z.string().url(),
  documentBackUrl: z.string().url().optional(),
  selfieUrl: z.string().url().optional(),
  consentAccepted: z.boolean(),
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const rl = await rateLimitForm(`verification-submit:${ip}`);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many verification submissions. Please try again shortly." }, { status: 429 });
  }

  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload", issues: parsed.error.flatten() }, { status: 400 });
  }
  return NextResponse.json(
    {
      error:
        "Identity document photos are not accepted. Ghana Card images are prohibited by L.I. 2523. Passport and driver's licence images are not collected on this shop. Where the law requires an identity check, it is done through the National Identification Authority.",
    },
    { status: 400 },
  );
}
