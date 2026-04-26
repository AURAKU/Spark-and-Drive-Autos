import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function resolveKey() {
  const raw = process.env.PROVIDER_SECRET_ENCRYPTION_KEY || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!raw) return null;
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const key = resolveKey();
  if (!key) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(value?: string | null): string {
  if (!value) return "";
  if (!value.startsWith("enc:v1:")) return value;
  const key = resolveKey();
  if (!key) return "";
  const [, , ivB64, tagB64, dataB64] = value.split(":");
  if (!ivB64 || !tagB64 || !dataB64) return "";
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const out = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
    return out.toString("utf8");
  } catch {
    return "";
  }
}

export function isConfiguredSecret(value?: string | null) {
  return Boolean(value && value.trim().length > 0);
}
