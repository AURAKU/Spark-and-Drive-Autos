import { NextResponse } from "next/server";

import { requireSuperAdmin } from "@/lib/auth-helpers";
import { getPublicAppUrl } from "@/lib/app-url";
import { getPaystackSecrets } from "@/lib/payment-provider-registry";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cfg = await getPaystackSecrets();
  const webhookUrl = `${getPublicAppUrl()}/api/webhooks/paystack`;
  return NextResponse.json({
    ok: true,
    readiness: {
      hasSecretKey: Boolean(cfg.secretKey),
      hasPublicKey: Boolean(cfg.publicKey),
      /** Optional extra field; signature verification uses `secretKey` only (Paystack docs). */
      hasWebhookSecret: Boolean(cfg.webhookSecret),
      callbackBaseUrl: cfg.callbackBaseUrl || null,
      webhookUrl,
      isLocalhostWebhook: webhookUrl.includes("localhost") || webhookUrl.includes("127.0.0.1"),
      webhookHeader: cfg.webhookHeaderName || "x-paystack-signature",
      webhookHashAlgorithm: cfg.webhookHashAlgorithm || "HMAC-SHA512",
      webhookSignatureNote:
        "Paystack signs webhooks with HMAC-SHA512(rawBody, your Secret Key). Ensure production PAYSTACK_SECRET_KEY / admin secret key matches the same key in the Paystack dashboard.",
    },
  });
}
