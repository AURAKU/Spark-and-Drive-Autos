import { isPaymentProofPdfUrl } from "@/lib/payment-proof-url";

export type UploadedFileKind = "image" | "pdf" | "unknown";

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|heic)(\?.*)?$/i;

/**
 * Classify how to preview an uploaded asset from optional MIME type and URL path.
 */
export function classifyUploadedFile(url: string, mimeType?: string | null): UploadedFileKind {
  if (mimeType) {
    const m = mimeType.toLowerCase();
    if (m === "application/pdf" || m.endsWith("/pdf")) return "pdf";
    if (m.startsWith("image/")) return "image";
  }
  const pathOnly = (() => {
    try {
      return new URL(url, "https://placeholder.local").pathname;
    } catch {
      return url;
    }
  })();
  const lower = pathOnly.toLowerCase();
  if (/\.pdf(\?|$)/i.test(lower) || isPaymentProofPdfUrl(url)) return "pdf";
  if (IMAGE_EXT.test(lower)) return "image";
  if (lower.includes("/image/upload/")) return "image";
  if (lower.includes("/raw/upload/")) return "pdf";
  /** Admin verification document proxy — images only today */
  if (lower.includes("/api/admin/verifications/") && lower.includes("/document")) return "image";
  return "unknown";
}
