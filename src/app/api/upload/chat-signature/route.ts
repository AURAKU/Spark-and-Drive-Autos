import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { findThreadOrThrow, getChatThreadAccess } from "@/lib/chat-access";
import { createUploadSignature } from "@/lib/cloudinary";

const schema = z.object({
  threadId: z.string().cuid(),
  /** `raw` = PDF, Office, txt, etc. (Cloudinary raw upload). */
  kind: z.enum(["image", "video", "audio", "raw"]),
});

/**
 * Signed upload for chat attachments (customer, guest, or admin with thread access).
 */
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
    return NextResponse.json({ ...sig, uploadUrl, kind, folder });
  } catch {
    return NextResponse.json({ error: "Cloudinary not configured" }, { status: 501 });
  }
}
