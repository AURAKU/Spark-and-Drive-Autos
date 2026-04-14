import { AttachmentKind } from "@prisma/client";

/** Allowed attachment URL hosts (Cloudinary delivery). */
const ALLOWED_HOST_SUFFIXES = ["res.cloudinary.com", "cloudinary.com"];

const MIME_BY_KIND: Record<AttachmentKind, readonly string[]> = {
  [AttachmentKind.IMAGE]: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/heic",
    "image/heif",
  ],
  [AttachmentKind.VIDEO]: ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"],
  [AttachmentKind.AUDIO]: ["audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/wav", "audio/x-wav"],
  [AttachmentKind.FILE]: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
    "application/octet-stream",
  ],
};

export type ChatAttachmentInput = {
  url: string;
  publicId?: string | null;
  kind: AttachmentKind;
  mimeType?: string | null;
  durationSec?: number | null;
};

function isAllowedAttachmentUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
  } catch {
    return false;
  }
}

/**
 * Reject SSRF / arbitrary URLs: only HTTPS Cloudinary asset URLs.
 * MIME must match kind when provided (empty mime allowed for legacy rows).
 */
export function assertChatAttachmentsSafe(attachments: ChatAttachmentInput[]): void {
  if (attachments.length > 8) {
    throw new Error("ATTACHMENT_LIMIT");
  }
  for (const a of attachments) {
    if (!isAllowedAttachmentUrl(a.url)) {
      throw new Error("ATTACHMENT_URL_FORBIDDEN");
    }
    const mime = (a.mimeType ?? "").trim().toLowerCase();
    if (!mime) continue;
    const allowed = MIME_BY_KIND[a.kind] ?? [];
    const ok =
      allowed.some((m) => m === mime) ||
      (a.kind === AttachmentKind.FILE && mime === "application/octet-stream");
    if (!ok) {
      throw new Error("ATTACHMENT_MIME_MISMATCH");
    }
  }
}
