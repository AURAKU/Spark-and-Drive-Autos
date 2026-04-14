import { PaymentProvider } from "@prisma/client";

import { getPublicAppUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";

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
  webhookSecret?: string;
  webhookUrl?: string;
  callbackBaseUrl?: string;
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
  return {
    secretKey: json?.secretKey?.trim() || process.env.PAYSTACK_SECRET_KEY || "",
    publicKey: json?.publicKey?.trim() || process.env.PAYSTACK_PUBLIC_KEY || "",
    webhookSecret: json?.webhookSecret?.trim() || json?.secretKey?.trim() || process.env.PAYSTACK_SECRET_KEY || "",
    webhookUrl: json?.webhookUrl?.trim() || "",
    callbackBaseUrl: json?.callbackBaseUrl?.trim() || "",
  };
}

/** Public origin for Paystack `callback_url` redirects (optional override from admin config). */
export async function getPaystackCallbackOrigin(): Promise<string> {
  const { callbackBaseUrl } = await getPaystackSecrets();
  const trimmed = callbackBaseUrl?.trim().replace(/\/$/, "") ?? "";
  if (trimmed.length > 0) return trimmed;
  return getPublicAppUrl();
}
