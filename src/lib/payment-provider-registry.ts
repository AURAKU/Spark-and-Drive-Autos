import { PaymentProvider } from "@prisma/client";

import { getPublicAppUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secret-crypto";

export async function getDefaultPaymentProvider(): Promise<PaymentProvider> {
  const cfg = await prisma.paymentProviderConfig.findFirst({
    where: { enabled: true, isDefault: true },
    orderBy: { updatedAt: "desc" },
  });
  return cfg?.provider ?? PaymentProvider.PAYSTACK;
}

type ProviderConfigPayload = {
  publicKey?: string;
  secretKey?: string;
  secretKeyEnc?: string;
  webhookSecret?: string;
  webhookSecretEnc?: string;
  webhookUrl?: string;
  callbackBaseUrl?: string;
  webhookHeaderName?: string;
  webhookHashAlgorithm?: string;
};

export async function getActivePaymentProviderConfig() {
  return prisma.paymentProviderConfig.findFirst({
    where: { enabled: true, isDefault: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getPaystackSecrets() {
  let config = await prisma.paymentProviderConfig.findFirst({
    where: { enabled: true, provider: PaymentProvider.PAYSTACK, isDefault: true },
    orderBy: { updatedAt: "desc" },
    select: { configJson: true },
  });
  if (!config) {
    config = await prisma.paymentProviderConfig.findFirst({
      where: { enabled: true, provider: PaymentProvider.PAYSTACK },
      orderBy: { updatedAt: "desc" },
      select: { configJson: true },
    });
  }
  const json = (config?.configJson ?? null) as ProviderConfigPayload | null;
  const decryptedSecret = decryptSecret(json?.secretKeyEnc) || json?.secretKey?.trim() || "";
  const decryptedWebhookSecret =
    decryptSecret(json?.webhookSecretEnc) || json?.webhookSecret?.trim() || decryptedSecret;
  return {
    secretKey: decryptedSecret || process.env.PAYSTACK_SECRET_KEY || "",
    publicKey: json?.publicKey?.trim() || process.env.PAYSTACK_PUBLIC_KEY || "",
    webhookSecret: decryptedWebhookSecret || process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY || "",
    webhookUrl: json?.webhookUrl?.trim() || "",
    callbackBaseUrl: json?.callbackBaseUrl?.trim() || "",
    webhookHeaderName: json?.webhookHeaderName?.trim() || "x-paystack-signature",
    webhookHashAlgorithm: json?.webhookHashAlgorithm?.trim() || "HMAC-SHA512",
  };
}

/** Public origin for Paystack `callback_url` redirects (optional override from admin config). */
export async function getPaystackCallbackOrigin(): Promise<string> {
  const { callbackBaseUrl } = await getPaystackSecrets();
  const trimmed = callbackBaseUrl?.trim().replace(/\/$/, "") ?? "";
  if (trimmed.length > 0) return trimmed;
  return getPublicAppUrl();
}
