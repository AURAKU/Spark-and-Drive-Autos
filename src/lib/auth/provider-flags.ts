function readEnv(...keys: string[]): string {
  for (const key of keys) {
    const raw = process.env[key];
    if (!raw) continue;
    const value = raw.trim();
    if (value) return value;
  }
  return "";
}

function looksPlaceholder(value: string): boolean {
  const v = value.toLowerCase();
  return v.includes("your_") || v.includes("placeholder") || v.includes("replace_me");
}

export function getGoogleOAuthCredentials(): { clientId: string; clientSecret: string } | null {
  const id = readEnv(
    "AUTH_GOOGLE_ID",
    "AUTH_GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_ID",
  ).replace(/\s+/g, "");
  const secret = readEnv(
    "AUTH_GOOGLE_SECRET",
    "AUTH_GOOGLE_CLIENT_SECRET",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_SECRET",
  ).replace(/\s+/g, "");

  if (!id || !secret) return null;
  if (looksPlaceholder(id) || looksPlaceholder(secret)) return null;
  if (!(id.endsWith(".apps.googleusercontent.com") || id.endsWith(".googleusercontent.com"))) return null;
  if (secret.length <= 10) return null;
  return { clientId: id, clientSecret: secret };
}

export function hasGoogleOAuth(): boolean {
  return Boolean(getGoogleOAuthCredentials());
}
