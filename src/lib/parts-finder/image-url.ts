/**
 * Normalize external image URLs for Parts Finder (Serper, CDNs, legacy stored rows).
 * Accepts https, http, and protocol-relative // URLs common in search APIs.
 */
export function normalizePartsFinderImageUrl(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.startsWith("data:") || lower.startsWith("javascript:") || lower.startsWith("file:")) return null;
  if (raw.startsWith("//")) {
    return normalizePartsFinderImageUrl(`https:${raw}`);
  }
  if (/^https:\/\//i.test(raw)) return raw;
  if (/^http:\/\//i.test(raw)) return raw.replace(/^http:\/\//i, "https://");
  return null;
}
