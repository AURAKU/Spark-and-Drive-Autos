import { isCloudinaryMediaUrl, optimizeCloudinaryUrl } from "@/lib/cloudinary-delivery";
import { cloudinaryVideoFramePosterUrl } from "@/lib/cloudinary-video-poster";
import { VEHICLE_IMAGE_PLACEHOLDER_SRC } from "@/lib/vehicle-image-fallback";

type VideoLike = {
  url: string;
  thumbnailUrl?: string | null;
  publicId?: string | null;
};

/**
 * Poster image for a car video: stored thumbnail → derived Cloudinary frame → first gallery/cover image → placeholder.
 */
export function resolveCarVideoPosterUrl(video: VideoLike, firstCarImageUrl?: string | null): string {
  const thumb = video.thumbnailUrl?.trim();
  if (thumb) {
    return isCloudinaryMediaUrl(thumb) ? optimizeCloudinaryUrl(thumb, "galleryStrip") : thumb;
  }
  const derived = cloudinaryVideoFramePosterUrl(video.url);
  if (derived) return optimizeCloudinaryUrl(derived, "galleryStrip");
  const fallback = firstCarImageUrl?.trim();
  if (fallback) {
    return isCloudinaryMediaUrl(fallback) ? optimizeCloudinaryUrl(fallback, "card") : fallback;
  }
  return VEHICLE_IMAGE_PLACEHOLDER_SRC;
}
