import { NextResponse } from "next/server";
import { z } from "zod";

import { createGhanaCardClientUploadSignature } from "@/lib/cloudinary";
import { safeAuth } from "@/lib/safe-auth";

const bodySchema = z.object({
  purpose: z.enum(["ghana-card"]).default("ghana-card"),
  mimeType: z.string().min(3).max(120).optional(),
});

/**
 * Signed Cloudinary upload for authenticated users (Ghana Card / ID).
 * POST JSON: { purpose?: "ghana-card", mimeType?: string }
 * Returns: timestamp, signature, apiKey, cloudName, folder, uploadUrl (…/auto/upload for JPG/PNG/WebP/PDF)
 *
 * Client must POST multipart to uploadUrl with: file, api_key, timestamp, signature, folder
 * (same fields that were included in the signature — see Cloudinary unsigned/signed upload docs).
 */
export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = {};
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const mimeType = parsed.data.mimeType ?? "image/jpeg";
  const folder = `sda/users/${session.user.id}/ghana-card`;

  try {
    if (parsed.data.purpose === "ghana-card") {
      const sig = await createGhanaCardClientUploadSignature({ folder, mimeType });
      return NextResponse.json(sig);
    }
    return NextResponse.json({ error: "Unsupported purpose" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload sign failed";
    if (msg.includes("not configured")) {
      return NextResponse.json({ error: "Cloudinary is not configured" }, { status: 501 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
