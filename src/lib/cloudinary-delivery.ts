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
  /** Inline car/parts gallery main stage — fast slide changes (not full lightbox). */
  | "galleryStage"
  | "galleryMain"
  | "galleryPremium"
  /** Parts/product detail main image — high quality without 4K payload. */
  | "partDetailHero"
  /** Video poster / first-frame still before the stream is requested. */
  | "posterStage"
  | "videoPreview"
  | "videoPremium"
  | "previewCompact"
  | "og";

const PRESET_TRANSFORMS: Record<Exclude<CloudinaryDeliveryPreset, "none">, string> = {
  /** Admin / dense lists — ~96px logical width */
  tableThumb: "c_limit,w_128,h_96,q_auto,f_auto",
  /** Storefront cards — retina-ready without a 4K payload */
  card: "c_limit,w_960,q_auto:best,f_auto",
  /** Gallery thumbnail strip — sharp enough for retina tiles, still tiny. */
  galleryStrip: "c_limit,w_400,h_300,q_auto:best,f_auto",
  /** Main carousel / product hero — retina-ready, never a muddy downscale. */
  galleryStage: "c_limit,w_1920,q_auto:best,f_auto",
  /** Hero + lightbox — cap width, keep quality */
  galleryMain: "c_limit,w_2560,q_auto:best,f_auto",
  /** Premium detail view — preserve high-end clarity without touching originals. */
  galleryPremium: "c_limit,w_3840,q_auto:best,f_auto",
  partDetailHero: "c_limit,w_2048,h_2048,q_auto:best,f_auto",
  /** Walkthrough poster shown before the video stream is requested. */
  posterStage: "c_limit,w_1280,q_auto:best,f_auto",
  /** Non-hero video playback for cards/lists/modals. */
  videoPreview: "c_limit,w_1920,q_auto:best,f_auto",
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
/** Tiny blurred frame for progressive card blur-up (no secrets; client-safe). */
export function cloudinaryBlurPlaceholderUrl(url: string): string | null {
  if (!url?.trim() || !isCloudinaryMediaUrl(url)) return null;
  const u = url.trim();
  if (u.includes("/raw/upload/")) return null;
  const m = u.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|video)\/upload\/)(.+)$/i);
  if (!m) return null;
  const prefix = m[1];
  const pathAfterUpload = m[2];
  const firstSeg = pathAfterUpload.split("/")[0] ?? "";
  if (firstSeg.includes(",")) return null;
  return `${prefix}c_limit,w_48,e_blur:800,q_1,f_auto/${pathAfterUpload}`;
}

const WIDTH_LADDERS: Record<string, readonly number[]> = {
  galleryStrip: [160, 280, 400],
  card: [480, 720, 960, 1280],
  galleryStage: [960, 1280, 1600, 1920, 2560],
  galleryMain: [1280, 1920, 2560],
  galleryPremium: [1600, 2048, 2560, 3840],
  partDetailHero: [960, 1280, 1600, 2048],
  posterStage: [640, 960, 1280],
};

function parseCloudinaryUpload(url: string): { prefix: string; rest: string; hasTransform: boolean } | null {
  const u = url.trim();
  if (!u || u.includes("/raw/upload/")) return null;
  const m = u.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|video)\/upload\/)(.+)$/i);
  if (!m) return null;
  const rest = m[2];
  const firstSeg = rest.split("/")[0] ?? "";
  return { prefix: m[1], rest, hasTransform: firstSeg.includes(",") };
}

export function optimizeCloudinaryUrl(url: string, preset: CloudinaryDeliveryPreset): string {
  if (preset === "none" || !url?.trim()) return url;
  const parsed = parseCloudinaryUpload(url);
  if (!parsed) return url.trim();
  if (parsed.hasTransform) return url.trim();
  const transform = PRESET_TRANSFORMS[preset as Exclude<CloudinaryDeliveryPreset, "none">];
  if (!transform) return url.trim();
  return `${parsed.prefix}${transform}/${parsed.rest}`;
}

/** Cloudinary already applies f_auto / q_auto:best — skip the Next optimizer hop. */
export function shouldBypassNextImageOptimizer(url: string): boolean {
  return isCloudinaryMediaUrl(url);
}

export function cloudinaryWidthUrl(url: string, width: number): string | null {
  const parsed = parseCloudinaryUpload(url);
  if (!parsed || parsed.hasTransform) return null;
  const w = Math.max(64, Math.round(width));
  return `${parsed.prefix}c_limit,w_${w},q_auto:best,f_auto/${parsed.rest}`;
}

export function cloudinarySrcSet(
  url: string,
  preset: CloudinaryDeliveryPreset,
): { src: string; srcSet?: string } {
  const src = optimizeCloudinaryUrl(url, preset);
  if (preset === "none") return { src };
  const widths = WIDTH_LADDERS[preset];
  if (!widths) return { src };
  const parts = widths
    .map((w) => {
      const href = cloudinaryWidthUrl(url, w);
      return href ? `${href} ${w}w` : null;
    })
    .filter((v): v is string => Boolean(v));
  if (parts.length === 0) return { src };
  return { src, srcSet: parts.join(", ") };
}
