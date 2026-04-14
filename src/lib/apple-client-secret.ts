import { SignJWT, importPKCS8 } from "jose";

/**
 * Apple Sign in requires a short-lived ES256 JWT as `clientSecret`.
 * Either set `AUTH_APPLE_SECRET` to a pre-generated JWT (e.g. from `npx auth add apple`),
 * or set `APPLE_TEAM_ID`, `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY` (contents of the .p8 file)
 * alongside `AUTH_APPLE_ID` (Services ID) so we can mint the JWT at runtime.
 */
export async function resolveAppleClientSecret(): Promise<string | undefined> {
  const clientId = process.env.AUTH_APPLE_ID?.trim();
  if (!clientId) return undefined;

  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const keyId = process.env.APPLE_KEY_ID?.trim();
  const rawKey = process.env.APPLE_PRIVATE_KEY?.trim();

  if (teamId && keyId && rawKey) {
    try {
      const pem = rawKey.includes("BEGIN PRIVATE KEY")
        ? rawKey.replace(/\\n/g, "\n")
        : `-----BEGIN PRIVATE KEY-----\n${rawKey.replace(/\\n/g, "\n")}\n-----END PRIVATE KEY-----`;
      const key = await importPKCS8(pem, "ES256");
      const now = Math.floor(Date.now() / 1000);
      const exp = now + 60 * 60 * 24 * 150; // < 6 months (Apple limit)

      return await new SignJWT({})
        .setProtectedHeader({ alg: "ES256", kid: keyId })
        .setIssuer(teamId)
        .setAudience("https://appleid.apple.com")
        .setSubject(clientId)
        .setIssuedAt(now)
        .setExpirationTime(exp)
        .sign(key);
    } catch (e) {
      console.error("[apple-client-secret] Failed to build JWT from APPLE_PRIVATE_KEY:", e);
      const legacy = process.env.AUTH_APPLE_SECRET?.trim();
      if (legacy) return legacy;
      return undefined;
    }
  }

  const legacy = process.env.AUTH_APPLE_SECRET?.trim();
  return legacy && legacy.length > 0 ? legacy : undefined;
}
