import { NextResponse } from "next/server";

import { createUploadSignature } from "@/lib/cloudinary";
import { safeAuth } from "@/lib/safe-auth";

export async function POST() {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const folder = `sda/users/${session.user.id}/ghana-card`;
    const sig = await createUploadSignature({ folder });
    const uploadUrl = `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`;
    return NextResponse.json({ ...sig, uploadUrl, folder });
  } catch {
    return NextResponse.json({ error: "Cloudinary not configured" }, { status: 501 });
  }
}
