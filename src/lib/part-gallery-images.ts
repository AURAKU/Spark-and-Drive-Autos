export type PartGalleryImage = { id: string; url: string };

/**
 * Deduplicated ordered list: cover first (if any), then additional uploads.
 * Server- and client-safe (no "use client" module).
 */
export function buildPartGalleryImageList(
  cover: string | null | undefined,
  partImages: PartGalleryImage[],
): PartGalleryImage[] {
  const out: PartGalleryImage[] = [];
  const seen = new Set<string>();
  const push = (id: string, url: string) => {
    const u = url.trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push({ id, url: u });
  };
  if (cover) push("cover", cover);
  for (const img of partImages) push(img.id, img.url);
  return out;
}
