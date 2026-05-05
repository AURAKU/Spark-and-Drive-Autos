/**
 * Client-safe Cloudinary delivery URL helpers (no secrets).
 * Inserts transformation segments after `/upload/` for smaller payloads on lists/cards.
 * @see https://cloudinary.com/documentation/image_transformations
 */

export type CloudinaryDeliveryPreset =
  | "none"
  | "tableThumb"
  | "card"
  | "galleryStrip"
  | "galleryMain"
  | "galleryPremium"
  | "videoPreview"
  | "videoPremium"
  | "previewCompact"
  | "og";

const PRESET_TRANSFORMS: Record<Exclude<CloudinaryDeliveryPreset, "none">, string> = {
  /** Admin / dense lists — ~96px logical width */
  tableThumb: "c_limit,w_128,h_96,q_auto,f_auto",
  /** Storefront cards — ~320–640px viewports */
  card: "c_limit,w_640,q_auto,f_auto",
  /** Gallery thumbnail strip */
  galleryStrip: "c_limit,w_280,h_200,q_auto,f_auto",
  /** Hero + lightbox — cap width, keep quality */
  galleryMain: "c_limit,w_1920,q_auto,f_auto",
  /** Premium detail view — preserve high-end clarity without touching originals. */
  galleryPremium: "c_limit,w_3840,q_auto:best,f_auto,dpr_auto",
  /** Non-hero video playback for cards/lists/modals. */
  videoPreview: "c_limit,w_1920,q_auto:good,f_auto",
  /** Hero video playback with premium adaptive quality. */
  videoPremium: "c_limit,w_3840,q_auto:best,f_auto",
  /** Compact inline proof / ID preview (still object-contain in UI) */
  previewCompact: "c_limit,w_480,q_auto,f_auto",
  /** Social / Open Graph share — bounded width, auto format/quality */
  og: "c_limit,w_1200,h_630,q_auto,f_auto",
};

const UPLOAD_SPLIT = /^https:\/\/res\.cloudinary\.com\/[^/]+\/(image|video)\/upload\//i;

export function isCloudinaryMediaUrl(url: string): boolean {
  if (!url?.trim()) return false;
  return UPLOAD_SPLIT.test(url.trim()) && !url.includes("/raw/upload/");
}

/**
 * Returns a transformed Cloudinary URL, or the original string if not Cloudinary or not transformable.
 */
export function optimizeCloudinaryUrl(url: string, preset: CloudinaryDeliveryPreset): string {
  if (preset === "none" || !url?.trim()) return url;
  const u = url.trim();
  if (u.includes("/raw/upload/")) return u;
  const m = u.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|video)\/upload\/)(.+)$/i);
  if (!m) return u;
  const prefix = m[1];
  const pathAfterUpload = m[2];
  const transform = PRESET_TRANSFORMS[preset as Exclude<CloudinaryDeliveryPreset, "none">];
  if (!transform) return u;

  const firstSeg = pathAfterUpload.split("/")[0] ?? "";
  if (firstSeg.includes(",")) return u;

  return `${prefix}${transform}/${pathAfterUpload}`;
}
