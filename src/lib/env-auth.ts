/**
 * True when the public app URL (AUTH_URL / NEXTAUTH_URL) uses HTTPS.
 */
function authPublicUrlIsHttps(): boolean {
  const raw = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (!raw?.trim()) return false;
  try {
    return new URL(raw.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Auth.js picks `__Secure-` / `__Host-` cookie names and the `Secure` flag when this is true.
 * Without it, requests that hit Node as `http` behind a reverse proxy would use non-secure cookie
 * names at sign-in, while middleware (`x-forwarded-proto: https`) would expect the `__Secure-`
 * session cookie — the session never appears and protected routes redirect to login.
 *
 * - Production: always secure.
 * - Set `AUTH_USE_SECURE_COOKIES=0` only for rare local debugging.
 * - Set `AUTH_USE_SECURE_COOKIES=1` to force secure cookies (e.g. HTTPS tunnel in dev).
 */
export function getUseSecureCookies(): boolean {
  const override = process.env.AUTH_USE_SECURE_COOKIES?.trim();
  if (override === "0") return false;
  if (override === "1") return true;
  if (process.env.NODE_ENV === "production") return true;
  return authPublicUrlIsHttps();
}

/**
 * Optional `Domain` for session-related cookies (e.g. `.example.com` when both apex and `www`
 * must share a session). Do not set unless you need cross-subdomain cookies; prefer one canonical
 * host via redirect. Omitted by default (host-only cookies). CSRF uses `__Host-` and must not
 * include `Domain` — that cookie is left to Auth.js defaults.
 */
export function getAuthCookieDomain(): string | undefined {
  const d = process.env.AUTH_COOKIE_DOMAIN?.trim();
  if (!d) return undefined;
  return d;
}

/**
 * Auth signing secret — required in production; dev falls back so `next dev` can start.
 */
export function getAuthSecret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET (or NEXTAUTH_SECRET) must be set to a random string of at least 32 characters in production."
    );
  }
  console.warn(
    "[env] AUTH_SECRET / NEXTAUTH_SECRET missing or short — using an insecure dev-only default. Set AUTH_SECRET in .env for stable sessions."
  );
  return "dev-only-insecure-auth-secret-min-32-chars!!";
}

/**
 * Rotation-safe secret list for Auth.js JWT decrypt/sign.
 * - First entry is used for new signing.
 * - Remaining entries are accepted for decryption (old cookies/tokens).
 */
export function getAuthSecrets(): string | string[] {
  const fromEnv = [process.env.AUTH_SECRET, process.env.NEXTAUTH_SECRET]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s && s.length >= 32));
  const unique = Array.from(new Set(fromEnv));
  if (unique.length > 1) return unique;
  if (unique.length === 1) return unique[0];
  return getAuthSecret();
}
