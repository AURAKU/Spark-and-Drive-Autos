import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { findThreadOrThrow, getChatThreadAccess } from "@/lib/chat-access";
import { CLOUDINARY_USER_MESSAGE, createUploadSignature, isCloudinaryMissingConfigError } from "@/lib/cloudinary";

const schema = z.object({
  threadId: z.string().cuid(),
  /** `raw` = PDF, Office, txt, etc. (Cloudinary raw upload). */
  kind: z.enum(["image", "video", "audio", "raw"]),
});

/**
 * Signed upload for chat attachments (customer, guest, or admin with thread access).
 */
export const runtime = "nodejs";

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
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const cookieStore = await cookies();
  const guest = cookieStore.get("sda_guest")?.value;
  const access = await getChatThreadAccess(thread, guest);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { threadId, kind } = parsed.data;
  const folder = `sda/chat/${threadId}/${kind}`;

  try {
    const sig = await createUploadSignature({ folder });
    const cloud = sig.cloudName as string;
    const uploadUrl =
      kind === "image"
        ? `https://api.cloudinary.com/v1_1/${cloud}/image/upload`
        : kind === "raw"
          ? `https://api.cloudinary.com/v1_1/${cloud}/raw/upload`
          : `https://api.cloudinary.com/v1_1/${cloud}/video/upload`;
    return NextResponse.json({
      timestamp: sig.timestamp,
      signature: sig.signature,
      apiKey: sig.apiKey,
      cloudName: sig.cloudName,
      folder: sig.folder,
      uploadUrl,
      kind,
    });
  } catch (e) {
    if (isCloudinaryMissingConfigError(e)) {
      console.warn("[api/upload/chat-signature] Cloudinary credentials missing");
      return NextResponse.json({ error: CLOUDINARY_USER_MESSAGE }, { status: 501 });
    }
    const msg = e instanceof Error ? e.message : "Upload sign failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
