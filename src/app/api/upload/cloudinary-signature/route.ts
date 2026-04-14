import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { createUploadSignature } from "@/lib/cloudinary";

const schema = z.object({
  folder: z.string().min(1).max(120),
  kind: z.enum(["image", "video"]).optional().default("image"),
});

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
    return NextResponse.json({ ...sig, uploadUrl, kind: parsed.data.kind });
  } catch {
    return NextResponse.json({ error: "Cloudinary not configured" }, { status: 501 });
  }
}
