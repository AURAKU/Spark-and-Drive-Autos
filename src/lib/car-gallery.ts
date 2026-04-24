export type CarGalleryImage = { id: string; url: string; alt: string };

/** Cover first (if set), then gallery images — URLs deduped. */
export function buildCarGalleryImages(car: {
  title: string;
  coverImageUrl: string | null;
  images: { id: string; url: string; altText: string | null }[];
}): CarGalleryImage[] {
  const seen = new Set<string>();
  const out: CarGalleryImage[] = [];
  const add = (id: string, url: string | null | undefined, alt: string) => {
    const u = url?.trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push({ id, url: u, alt });
  };
  add("cover", car.coverImageUrl, car.title);
  for (const im of car.images) {
    add(im.id, im.url, im.altText?.trim() ? im.altText : car.title);
  }
  return out;
}
