/**
 * Accept only Cloudinary image delivery URLs from our account (prevents arbitrary URL injection on create).
 */
export function isAllowedPartSourcingImageUrl(url: string): boolean {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  if (!cloud) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (u.hostname !== "res.cloudinary.com") return false;
    if (!u.pathname.includes(`/${cloud}/`) || !u.pathname.includes("/image/upload/")) return false;
    return true;
  } catch {
    return false;
  }
}
