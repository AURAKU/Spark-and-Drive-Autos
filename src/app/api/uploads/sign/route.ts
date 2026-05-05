import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import {
  CLOUDINARY_USER_MESSAGE,
  createAutoFolderUploadSignature,
  createGhanaCardClientUploadSignature,
  isCloudinaryMissingConfigError,
} from "@/lib/cloudinary";
import { safeAuth } from "@/lib/safe-auth";

const looseBody = z.object({
  purpose: z.enum(["ghana-card", "admin-inventory"]).optional(),
  folder: z.string().optional(),
  mimeType: z.string().min(3).max(120).optional(),
});

/**
 * Signed Cloudinary upload.
 *
 * - `ghana-card`: authenticated user; folder derived server-side.
 * - `admin-inventory`: admin only; client sends `folder` (allowlisted in cloudinary.ts).
 *
 * Returns: timestamp, signature, apiKey, cloudName, folder, uploadUrl (…/auto/upload).
 * Never exposes CLOUDINARY_API_SECRET.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = {};
  }

  const parsedLoose = looseBody.safeParse(json);
  if (!parsedLoose.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const purpose = parsedLoose.data.purpose ?? "ghana-card";

  if (purpose === "admin-inventory") {
    const folderRaw = parsedLoose.data.folder?.trim();
    if (!folderRaw) {
      return NextResponse.json({ error: "folder is required for admin-inventory" }, { status: 400 });
    }
    if (!/^[a-z0-9/_-]{3,180}$/i.test(folderRaw)) {
      return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
    }

    try {
      await requireAdmin();
    } catch (e) {
      if (e instanceof Error && e.message === "UNAUTHORIZED") {
        console.info("[api/uploads/sign] admin-inventory: no session");
        return NextResponse.json({ error: "Please log in as admin to upload media." }, { status: 401 });
      }
      if (e instanceof Error && e.message === "FORBIDDEN") {
        console.info("[api/uploads/sign] admin-inventory: not an admin role");
        return NextResponse.json({ error: "Admin access is required to upload inventory media." }, { status: 403 });
      }
      throw e;
    }

    try {
      const sig = createAutoFolderUploadSignature({ folder: folderRaw });
      return NextResponse.json({
        timestamp: sig.timestamp,
        signature: sig.signature,
        apiKey: sig.apiKey,
        cloudName: sig.cloudName,
        folder: sig.folder,
        uploadUrl: sig.uploadUrl,
      });
    } catch (e) {
      if (isCloudinaryMissingConfigError(e)) {
        console.warn("[api/uploads/sign] Cloudinary credentials missing (admin-inventory)");
        return NextResponse.json({ error: CLOUDINARY_USER_MESSAGE }, { status: 501 });
      }
      const msg = e instanceof Error ? e.message : "Upload sign failed";
      if (msg.includes("not allowed") || msg.includes("Unsafe")) {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mimeType = parsedLoose.data.mimeType ?? "image/jpeg";
  const folder = `sda/users/${session.user.id}/ghana-card`;

  try {
    const sig = await createGhanaCardClientUploadSignature({ folder, mimeType });
    return NextResponse.json({
      timestamp: sig.timestamp,
      signature: sig.signature,
      apiKey: sig.apiKey,
      cloudName: sig.cloudName,
      folder: sig.folder,
      uploadUrl: sig.uploadUrl,
    });
  } catch (e) {
    if (isCloudinaryMissingConfigError(e)) {
      console.warn("[api/uploads/sign] Cloudinary credentials missing (ghana-card)");
      return NextResponse.json({ error: CLOUDINARY_USER_MESSAGE }, { status: 501 });
    }
    const msg = e instanceof Error ? e.message : "Upload sign failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
