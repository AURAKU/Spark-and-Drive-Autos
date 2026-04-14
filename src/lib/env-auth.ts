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
