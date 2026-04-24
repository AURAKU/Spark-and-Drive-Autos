/**
 * Payment proofs must reference assets we host on Cloudinary (signed image or raw PDF upload).
 * Blocks arbitrary URLs that could point at internal/metadata endpoints or confuse reviewers.
 */
export function isTrustedPaymentProofUrl(url: string): boolean {
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

/** @deprecated Use isTrustedPaymentProofUrl */
export const isTrustedPaymentProofImageUrl = isTrustedPaymentProofUrl;

/** Cloudinary raw uploads use `/raw/upload/` in the delivery URL; some PDFs may end in `.pdf`. */
export function isPaymentProofPdfUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.pathname.includes("/raw/upload/") || /\.pdf(\?|$)/i.test(u.pathname);
  } catch {
    return false;
  }
}
