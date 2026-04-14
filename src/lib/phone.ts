/**
 * Minimal phone normalization for credential matching.
 * Keeps '+' and digits, strips spaces/punctuation, converts leading 00 -> +.
 */
export function normalizePhone(input: string): string {
  return input.trim().replace(/[^\d+]/g, "").replace(/^00/, "+");
}
