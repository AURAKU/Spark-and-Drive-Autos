import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { CLOUDINARY_USER_MESSAGE, createUploadSignature, isCloudinaryMissingConfigError } from "@/lib/cloudinary";

const schema = z.object({
  folder: z.string().min(1).max(120),
  kind: z.enum(["image", "video"]).optional().default("image"),
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
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
    return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
  }

  try {
    const sig = await createUploadSignature({ folder: parsed.data.folder });
    const cloud = sig.cloudName as string;
    const uploadUrl =
      parsed.data.kind === "video"
        ? `https://api.cloudinary.com/v1_1/${cloud}/video/upload`
        : `https://api.cloudinary.com/v1_1/${cloud}/image/upload`;
    return NextResponse.json({
      timestamp: sig.timestamp,
      signature: sig.signature,
      apiKey: sig.apiKey,
      cloudName: sig.cloudName,
      folder: sig.folder,
      uploadUrl,
      kind: parsed.data.kind,
    });
  } catch (e) {
    if (isCloudinaryMissingConfigError(e)) {
      console.warn("[api/upload/cloudinary-signature] Cloudinary credentials missing");
      return NextResponse.json({ error: CLOUDINARY_USER_MESSAGE }, { status: 501 });
    }
    const msg = e instanceof Error ? e.message : "Upload sign failed";
    console.warn("[api/upload/cloudinary-signature]", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
