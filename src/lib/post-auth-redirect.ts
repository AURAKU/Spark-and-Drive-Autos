/**
 * Where to send users after sign-in or sign-up (credentials or OAuth).
 * Preserves explicit relative callback URLs (e.g. checkout); otherwise customer dashboard.
 * Admins use the same default — they switch to admin via UI (Phase B), not via redirect.
 */
/**
 * Returns a safe same-origin path. Rejects protocol-relative URLs (`//…`) and
 * other values that could act as open redirects when passed as `callbackUrl`.
 */
export function getPostAuthRedirectUrl(callbackUrl: string | null | undefined): string {
  if (callbackUrl == null || callbackUrl === "") {
    return "/dashboard";
  }
  const trimmed = callbackUrl.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/dashboard";
  }
  if (trimmed.includes("://") || trimmed.includes("\\")) {
    return "/dashboard";
  }
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("/\\") || lower.includes("%2f%2f") || lower.includes("javascript:")) {
    return "/dashboard";
  }
  return trimmed;
}
