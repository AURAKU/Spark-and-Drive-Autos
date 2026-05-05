import { NextResponse } from "next/server";

import { CLOUDINARY_USER_MESSAGE, createUploadSignature, isCloudinaryMissingConfigError } from "@/lib/cloudinary";
import { safeAuth } from "@/lib/safe-auth";

export const runtime = "nodejs";

export async function POST() {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const folder = `sda/users/${session.user.id}/ghana-card`;
    const sig = await createUploadSignature({ folder });
    const uploadUrl = `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`;
    return NextResponse.json({
      timestamp: sig.timestamp,
      signature: sig.signature,
      apiKey: sig.apiKey,
      cloudName: sig.cloudName,
      folder: sig.folder,
      uploadUrl,
    });
  } catch (e) {
    if (isCloudinaryMissingConfigError(e)) {
      console.warn("[api/upload/profile-id-signature] Cloudinary credentials missing");
      return NextResponse.json({ error: CLOUDINARY_USER_MESSAGE }, { status: 501 });
    }
    const msg = e instanceof Error ? e.message : "Upload sign failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
