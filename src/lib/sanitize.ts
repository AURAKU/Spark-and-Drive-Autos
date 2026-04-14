/** Plain text: trim, length cap, remove control chars. Use for chat, inquiries, and public forms. */
export function sanitizePlainText(input: string, maxLen = 10_000): string {
  const trimmed = input.trim().slice(0, maxLen);
  return trimmed.replace(/[\u0000-\u001F\u007F]/g, "");
}

/** Minimal HTML strip for untrusted snippets (not a full XSS policy; prefer plain text for user content). */
export function stripHtmlTags(input: string, maxLen = 50_000): string {
  return input.replace(/<[^>]*>/g, "").slice(0, maxLen);
}
