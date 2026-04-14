/**
 * Payment proofs must reference images we host on Cloudinary (uploaded via signed POST).
 * Blocks arbitrary URLs that could point at internal/metadata endpoints or confuse reviewers.
 */
export function isTrustedPaymentProofImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    if (u.hostname === "res.cloudinary.com") return true;
    const custom = process.env.CLOUDINARY_SECURE_HOST?.trim();
    if (custom && u.hostname === custom) return true;
    return false;
  } catch {
    return false;
  }
}
