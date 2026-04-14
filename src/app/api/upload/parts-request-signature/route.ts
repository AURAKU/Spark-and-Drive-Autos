import { NextResponse } from "next/server";
import { z } from "zod";

import { createUploadSignature } from "@/lib/cloudinary";
import { safeAuth } from "@/lib/safe-auth";

const schema = z.object({
  uploadSessionId: z.string().uuid(),
});

/**
 * Signed Cloudinary upload for part-sourcing reference images (signed-in customers only).
 */
export async function POST(req: Request) {
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
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const folder = `sda/part-sourcing/${session.user.id}/${parsed.data.uploadSessionId}`;

  try {
    const sig = await createUploadSignature({ folder });
    const uploadUrl = `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`;
    return NextResponse.json({ ...sig, uploadUrl, folder });
  } catch {
    return NextResponse.json({ error: "Cloudinary not configured" }, { status: 501 });
  }
}
