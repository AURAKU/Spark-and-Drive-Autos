import { createHmac, timingSafeEqual } from "node:crypto";

function reportSecret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET is required for duty report access tokens");
  }
  return s;
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  return Buffer.from(padded, "base64");
}

export type DutyReportAccessPayload = {
  cid: string;
  exp: number;
};

/** Short-lived HMAC token so guests can open their own report without guessing cuid IDs. */
export function signDutyReportAccessToken(calculationId: string, ttlSeconds = 60 * 60 * 24 * 7): string {
  const payload: DutyReportAccessPayload = {
    cid: calculationId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", reportSecret()).update(body).digest();
  return `${body}.${b64url(sig)}`;
}

export function verifyDutyReportAccessToken(
  token: string | null | undefined,
  calculationId: string,
): boolean {
  if (!token || !token.includes(".")) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  try {
    const expected = createHmac("sha256", reportSecret()).update(body).digest();
    const provided = fromB64url(sig);
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return false;
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as DutyReportAccessPayload;
    if (payload.cid !== calculationId) return false;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch {
    return false;
  }
}
