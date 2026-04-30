import { readFile } from "node:fs/promises";
import path from "node:path";

const RECEIPTS_DIR = path.join(process.cwd(), "public", "receipts");

/**
 * Parses stored receipt URLs like `/receipts/SDA-RCP-ABC.pdf` or absolute same-origin URLs.
 */
export function parseReceiptsFilename(pdfUrl: string): string | null {
  const s = pdfUrl.trim();
  let pathname = s;
  if (/^https?:\/\//i.test(s)) {
    try {
      pathname = new URL(s).pathname;
    } catch {
      return null;
    }
  }
  if (!pathname.startsWith("/receipts/")) return null;
  const name = path.basename(pathname);
  if (!name.endsWith(".pdf") || name.includes("..") || name.includes("/")) return null;
  return name;
}

export async function readReceiptPdfFromPublicStore(pdfUrl: string): Promise<Buffer | null> {
  const name = parseReceiptsFilename(pdfUrl);
  if (!name) return null;
  const full = path.join(RECEIPTS_DIR, name);
  const resolved = path.resolve(full);
  const dirResolved = path.resolve(RECEIPTS_DIR);
  if (!resolved.startsWith(dirResolved)) return null;
  try {
    return await readFile(resolved);
  } catch {
    return null;
  }
}

export function sanitizeReceiptDownloadFilename(base: string): string {
  const cleaned = base.replace(/[^\w.\-]+/g, "_");
  return cleaned.endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}
