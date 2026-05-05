/**
 * Build a Cloudinary **image** URL that shows frame 0 of a **video** asset (poster / thumbnail).
 * Client-safe — no secrets.
 *
 * @see https://cloudinary.com/documentation/video_manipulation_and_delivery
 */
export function cloudinaryVideoFramePosterUrl(videoSecureUrl: string): string | null {
  const trimmed = videoSecureUrl.trim();
  if (!trimmed.includes("res.cloudinary.com") || !/video\/upload/i.test(trimmed)) return null;

  const m = trimmed.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+)\/video\/upload\/(.+)$/i);
  if (!m) return null;

  const base = m[1];
  let pathAfterUpload = m[2].split("?")[0] ?? m[2];
  const transform = "so_0,q_auto,f_auto,w_960,c_limit";
  const firstSeg = pathAfterUpload.split("/")[0] ?? "";
  if (firstSeg.includes(",")) {
    pathAfterUpload = `${transform}/${pathAfterUpload}`;
  } else {
    pathAfterUpload = `${transform}/${pathAfterUpload}`;
  }

  pathAfterUpload = pathAfterUpload.replace(/\.(mp4|webm|mov|m4v|avi|mkv|mpeg|mpg|3gp)(\?.*)?$/i, ".jpg");

  return `${base}/video/upload/${pathAfterUpload}`;
}
