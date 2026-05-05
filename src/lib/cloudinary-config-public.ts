/**
 * Client-safe Cloudinary helpers (no `cloudinary` SDK). Import from browser code.
 */

export const CLOUDINARY_USER_MESSAGE =
  "File uploads are unavailable because Cloudinary is not configured on the server. An administrator must set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET (and optionally NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME for client fallbacks).";

/** Optional: same cloud name as server, for building upload URLs when the sign response omits uploadUrl. */
export function readPublicCloudinaryCloudName(): string | undefined {
  if (typeof process === "undefined") return undefined;
  const v = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  return v || undefined;
}

/** Shown when POST /api/uploads/sign returns 401 for admin inventory uploads. */
export const ADMIN_MEDIA_UPLOAD_UNAUTHORIZED_MESSAGE = "Please log in as admin to upload media.";
