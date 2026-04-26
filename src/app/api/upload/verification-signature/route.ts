import { NextResponse } from "next/server";
import { z } from "zod";

import { createPaymentProofUploadSignature } from "@/lib/cloudinary";
import { getRequestIp } from "@/lib/client-ip";
import { rateLimitForm } from "@/lib/rate-limit";
import { safeAuth } from "@/lib/safe-auth";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];

const schema = z.object({
  kind: z.enum(["front", "back", "selfie"]),
  mimeType: z.string().min(3).max(100),
  sizeBytes: z.number().int().positive().max(MAX_IMAGE_BYTES),
});

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload payload" }, { status: 400 });
  }

  if (!allowedImageTypes.includes(parsed.data.mimeType)) {
    return NextResponse.json({ error: "Unsupported file type. Use JPG, PNG, or WebP." }, { status: 400 });
  }

  const folder = `sda/verification/${session.user.id}/${parsed.data.kind}`;
  try {
    const sig = await createPaymentProofUploadSignature({ folder, kind: "image" });
    return NextResponse.json(sig);
  } catch {
    return NextResponse.json({ error: "Cloudinary not configured" }, { status: 501 });
  }
}
