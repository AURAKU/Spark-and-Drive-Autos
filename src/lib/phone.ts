/**
 * Minimal phone normalization for credential matching.
 * Keeps '+' and digits, strips spaces/punctuation, converts leading 00 -> +.
 */
export function normalizePhone(input: string): string {
  return input.trim().replace(/[^\d+]/g, "").replace(/^00/, "+");
}

/** True when normalized value has 9–15 digits (typical international mobile range). */
export function isValidNormalizedPhoneDigits(normalized: string): boolean {
  const digits = normalized.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}

/** Account phone is unset when null, undefined, or whitespace-only. */
export function isAccountPhoneBlank(phone: string | null | undefined): boolean {
  return !phone?.trim();
}
