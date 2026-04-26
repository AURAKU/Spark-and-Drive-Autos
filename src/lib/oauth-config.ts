import { hasGoogleOAuth } from "@/lib/auth/provider-flags";

/**
 * Server-only OAuth configuration helpers.
 * Keep provider visibility logic on the server; never expose secrets to clients.
 *
 * Apple Sign-In is **off by default**. Set `ENABLE_APPLE_OAUTH=1` plus full Apple
 * credentials to opt in. This keeps production readiness independent of Apple.
 */
function isAppleOAuthOptInEnabled(): boolean {
  return process.env.ENABLE_APPLE_OAUTH?.trim() === "1";
}

export function isGoogleAuthConfigured(): boolean {
  return hasGoogleOAuth();
}

export function isAppleAuthConfigured(): boolean {
  if (!isAppleOAuthOptInEnabled()) return false;
  const id = Boolean(process.env.AUTH_APPLE_ID?.trim());
  const legacySecret = Boolean(process.env.AUTH_APPLE_SECRET?.trim());
  const fromP8 = Boolean(
    process.env.APPLE_TEAM_ID?.trim() &&
      process.env.APPLE_KEY_ID?.trim() &&
      process.env.APPLE_PRIVATE_KEY?.trim(),
  );
  return id && (legacySecret || fromP8);
}
