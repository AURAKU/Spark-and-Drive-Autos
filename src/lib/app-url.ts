/**
 * Canonical public origin for redirects, Paystack callbacks, and metadata.
 * Prefer AUTH_URL (Auth.js) then NEXTAUTH_URL; default matches local dev on port 5173.
 */
export function getPublicAppUrl(): string {
  const raw = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:5173";
  return raw.replace(/\/$/, "");
}
