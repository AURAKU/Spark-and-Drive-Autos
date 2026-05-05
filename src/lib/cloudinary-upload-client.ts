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
  const isVideo =
    mime === "video/mp4" ||
    mime === "video/webm" ||
    /\.(mp4|webm)$/i.test(name);

  if (kind === "video") {
    if (!isVideo) {
      throw new Error("Video must be MP4 or WebM.");
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
    throw new Error(err?.slice(0, 200) || "Upload failed");
  }
  return up.json() as Promise<{ secure_url: string; public_id: string }>;
}
