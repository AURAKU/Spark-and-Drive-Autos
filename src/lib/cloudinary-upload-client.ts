/**
 * Client-side upload to Cloudinary for **admin inventory** (cars, parts gallery/cover).
 * Uses POST /api/uploads/sign with purpose `admin-inventory` and uploads to Cloudinary `auto/upload`.
 *
 * Does not read CLOUDINARY_* secrets in the browser — only the sign API response + optional NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME.
 */
import {
  ADMIN_MEDIA_UPLOAD_UNAUTHORIZED_MESSAGE,
  CLOUDINARY_USER_MESSAGE,
  readPublicCloudinaryCloudName,
} from "@/lib/cloudinary-config-public";

type AdminSignResponse = {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName?: string;
  folder: string;
  uploadUrl?: string;
};

/** Per-file limit for admin inventory videos (client guard; Cloudinary plan may allow less). */
export const INVENTORY_VIDEO_MAX_BYTES = 500 * 1024 * 1024;

export function inventoryVideoMaxSizeLabel(): string {
  return "500 MB";
}

const INVENTORY_VIDEO_EXT = /\.(mp4|webm|mov|m4v|avi|mkv|3gp|mpeg|mpg)$/i;

const INVENTORY_VIDEO_MIMES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-quicktime",
  "video/m4v",
  "video/x-m4v",
  "video/avi",
  "video/x-msvideo",
  "video/matroska",
  "video/x-matroska",
  "video/3gpp",
  "video/3gpp2",
  "video/mpeg",
  "video/mpg",
  "video/x-mpeg",
]);

export const CLOUDINARY_VIDEO_FORMAT_REJECTED_MESSAGE =
  "This video format could not be processed. Please try MP4, MOV, or WEBM.";

function isInventoryVideoFile(file: File): boolean {
  const mime = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  if (INVENTORY_VIDEO_EXT.test(name)) return true;
  if (INVENTORY_VIDEO_MIMES.has(mime)) return true;
  return false;
}

function cloudinaryVideoUploadErrorMessage(status: number, raw: string): string {
  if (status === 413) {
    return "This file is too large to upload. Try a smaller or shorter video.";
  }
  let msg = raw;
  try {
    const j = JSON.parse(raw) as { error?: { message?: string } };
    if (typeof j?.error?.message === "string") msg = j.error.message;
  } catch {
    /* use raw */
  }
  const hint = msg.toLowerCase();
  if (/too large|file size|max(imum)? size|exceed(s)?/i.test(hint)) {
    return "This file is too large to upload. Try a smaller or shorter video.";
  }
  const probablyFormat =
    status === 400 ||
    status === 415 ||
    status === 422 ||
    /invalid|unsupported|not allowed|format|codec|container|mime|decode|corrupt|malformed/i.test(hint);
  if (probablyFormat) return CLOUDINARY_VIDEO_FORMAT_REJECTED_MESSAGE;
  return msg.trim().slice(0, 200) || "Upload failed";
}

function resolveAutoUploadUrl(data: AdminSignResponse): string {
  const cloudName = data.cloudName?.trim() || readPublicCloudinaryCloudName() || "";
  if (!cloudName) return "";
  return `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
}

function assertInventoryFileAllowed(file: File, kind: "image" | "video"): void {
  const mime = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();

  const isImageType =
    mime === "image/jpeg" ||
    mime === "image/jpg" ||
    mime === "image/png" ||
    mime === "image/webp" ||
    /\.(jpe?g|png|webp)$/i.test(name);
  const isPdf = mime === "application/pdf" || name.endsWith(".pdf");

  if (kind === "video") {
    if (!isInventoryVideoFile(file)) {
      throw new Error(
        "Unsupported video type. Use MP4, WebM, MOV, M4V, AVI, MKV, 3GP, MPEG, or MPG.",
      );
    }
    return;
  }

  if (!isImageType && !isPdf) {
    throw new Error("Allowed: JPG, JPEG, PNG, WebP, or PDF.");
  }
}

export async function uploadFileToCloudinary(
  file: File,
  folder: string,
  kind: "image" | "video" = "image",
): Promise<{ secure_url: string; public_id: string }> {
  assertInventoryFileAllowed(file, kind);

  if (kind === "video" && file.size > INVENTORY_VIDEO_MAX_BYTES) {
    throw new Error(`Videos must be ${inventoryVideoMaxSizeLabel()} or smaller.`);
  }

  const sigRes = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      purpose: "admin-inventory",
      folder: folder.trim(),
      mimeType: file.type || "application/octet-stream",
    }),
  });

  const raw = await sigRes.text();
  let payload = {} as AdminSignResponse & { error?: string };
  try {
    payload = JSON.parse(raw) as AdminSignResponse & { error?: string };
  } catch {
    payload = {} as AdminSignResponse & { error?: string };
  }
  const message = typeof payload.error === "string" ? payload.error : "";

  if (sigRes.status === 401) {
    console.warn("[cloudinary-upload-client] admin sign 401", message);
    throw new Error(message || ADMIN_MEDIA_UPLOAD_UNAUTHORIZED_MESSAGE);
  }
  if (sigRes.status === 403) {
    console.warn("[cloudinary-upload-client] admin sign 403", message);
    throw new Error(message || "Admin access is required to upload inventory media.");
  }
  if (sigRes.status === 501) {
    console.warn("[cloudinary-upload-client] admin sign 501 — Cloudinary not configured on server");
    throw new Error(message || CLOUDINARY_USER_MESSAGE);
  }
  if (!sigRes.ok) {
    console.warn("[cloudinary-upload-client] admin sign failed", sigRes.status, message);
    throw new Error(message || "Could not sign upload. Try again or contact support.");
  }

  const data = payload as AdminSignResponse;
  const uploadUrl = data.uploadUrl?.trim() || resolveAutoUploadUrl(data);
  if (!uploadUrl) {
    console.error("[cloudinary-upload-client] missing cloud name for auto/upload");
    throw new Error(
      "Upload address is missing. Ensure the sign response includes cloudName or set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME.",
    );
  }

  const fd = new FormData();
  fd.append("file", file);
  fd.append("api_key", data.apiKey);
  fd.append("timestamp", String(data.timestamp));
  fd.append("signature", data.signature);
  fd.append("folder", data.folder);

  const up = await fetch(uploadUrl, { method: "POST", body: fd });
  if (!up.ok) {
    const err = await up.text();
    console.warn("[cloudinary-upload-client] Cloudinary POST failed", up.status);
    if (kind === "video") {
      throw new Error(cloudinaryVideoUploadErrorMessage(up.status, err));
    }
    throw new Error(err?.slice(0, 200) || "Upload failed");
  }
  return up.json() as Promise<{ secure_url: string; public_id: string }>;
}
