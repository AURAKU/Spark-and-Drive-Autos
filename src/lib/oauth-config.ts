/**
 * Server-only OAuth configuration helpers.
 * Keep provider visibility logic on the server; never expose secrets to clients.
 */
export function isGoogleAuthConfigured(): boolean {
  return Boolean(
    process.env.AUTH_GOOGLE_ID?.trim().length && process.env.AUTH_GOOGLE_SECRET?.trim().length,
  );
}

export function isAppleAuthConfigured(): boolean {
  const id = Boolean(process.env.AUTH_APPLE_ID?.trim());
  const legacySecret = Boolean(process.env.AUTH_APPLE_SECRET?.trim());
  const fromP8 = Boolean(
    process.env.APPLE_TEAM_ID?.trim() &&
      process.env.APPLE_KEY_ID?.trim() &&
      process.env.APPLE_PRIVATE_KEY?.trim(),
  );
  return id && (legacySecret || fromP8);
}
