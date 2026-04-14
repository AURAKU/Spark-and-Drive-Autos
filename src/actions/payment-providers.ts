"use server";

import { PaymentProvider } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const baseFields = {
  provider: z.nativeEnum(PaymentProvider),
  label: z.string().min(2).max(80),
  enabled: z.preprocess((v) => v === "on" || v === "true", z.boolean()).default(false),
  isDefault: z.preprocess((v) => v === "on" || v === "true", z.boolean()).default(false),
  publicKey: z.string().max(300).optional(),
  secretKey: z.string().max(300).optional(),
  webhookSecret: z.string().max(300).optional(),
  webhookUrl: z.string().max(500).optional(),
  callbackBaseUrl: z.string().max(500).optional(),
  apiBaseUrl: z.string().max(500).optional(),
  initializeEndpoint: z.string().max(300).optional(),
  verifyEndpoint: z.string().max(300).optional(),
  webhookHeaderName: z.string().max(100).optional(),
  webhookHashAlgorithm: z.string().max(100).optional(),
  integrationNotes: z.string().max(4000).optional(),
};

const schema = z.object(baseFields);

type ConfigJson = {
  publicKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  webhookUrl?: string;
  callbackBaseUrl?: string;
  apiBaseUrl?: string;
  initializeEndpoint?: string;
  verifyEndpoint?: string;
  webhookHeaderName?: string;
  webhookHashAlgorithm?: string;
  integrationNotes?: string;
};

function normalizeMaybeUrl(value: string): string {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.includes(".") && !value.includes(" ")) return `https://${value}`;
  return value;
}

function parseForm(formData: FormData) {
  return schema.safeParse({
    provider: formData.get("provider"),
    label: formData.get("label"),
    enabled: formData.get("enabled"),
    isDefault: formData.get("isDefault"),
    publicKey: String(formData.get("publicKey") ?? "").trim(),
    secretKey: String(formData.get("secretKey") ?? "").trim(),
    webhookSecret: String(formData.get("webhookSecret") ?? "").trim(),
    webhookUrl: normalizeMaybeUrl(String(formData.get("webhookUrl") ?? "").trim()),
    callbackBaseUrl: normalizeMaybeUrl(String(formData.get("callbackBaseUrl") ?? "").trim()),
    apiBaseUrl: normalizeMaybeUrl(String(formData.get("apiBaseUrl") ?? "").trim()),
    initializeEndpoint: String(formData.get("initializeEndpoint") ?? "").trim(),
    verifyEndpoint: String(formData.get("verifyEndpoint") ?? "").trim(),
    webhookHeaderName: String(formData.get("webhookHeaderName") ?? "").trim(),
    webhookHashAlgorithm: String(formData.get("webhookHashAlgorithm") ?? "").trim(),
    integrationNotes: String(formData.get("integrationNotes") ?? "").trim(),
  });
}

function mergeConfigJson(
  prev: ConfigJson | null | undefined,
  d: z.infer<typeof schema>,
): ConfigJson {
  const p = prev ?? {};
  return {
    publicKey: d.publicKey || p.publicKey,
    secretKey: d.secretKey ? d.secretKey : p.secretKey,
    webhookSecret: d.webhookSecret ? d.webhookSecret : p.webhookSecret,
    webhookUrl: d.webhookUrl || p.webhookUrl,
    callbackBaseUrl: d.callbackBaseUrl || p.callbackBaseUrl,
    apiBaseUrl: d.apiBaseUrl || p.apiBaseUrl,
    initializeEndpoint: d.initializeEndpoint || p.initializeEndpoint,
    verifyEndpoint: d.verifyEndpoint || p.verifyEndpoint,
    webhookHeaderName: d.webhookHeaderName || p.webhookHeaderName,
    webhookHashAlgorithm: d.webhookHashAlgorithm || p.webhookHashAlgorithm,
    integrationNotes: d.integrationNotes || p.integrationNotes,
  };
}

export async function savePaymentProviderConfig(formData: FormData) {
  await requireAdmin();
  const idRaw = formData.get("id");
  const id = typeof idRaw === "string" && idRaw.length > 0 ? idRaw : undefined;

  const parsed = parseForm(formData);
  if (!parsed.success) return;

  const d = parsed.data;

  if (d.isDefault) {
    await prisma.paymentProviderConfig.updateMany({ data: { isDefault: false } });
  }

  if (id) {
    const existing = await prisma.paymentProviderConfig.findUnique({ where: { id } });
    if (!existing) return;
    const merged = mergeConfigJson(existing.configJson as ConfigJson, d);
    await prisma.paymentProviderConfig.update({
      where: { id },
      data: {
        provider: d.provider,
        label: d.label,
        enabled: d.enabled,
        isDefault: d.isDefault,
        configJson: merged,
      },
    });
  } else {
    const existing = await prisma.paymentProviderConfig.findUnique({
      where: {
        provider_label: { provider: d.provider, label: d.label },
      },
    });
    const merged = mergeConfigJson(existing?.configJson as ConfigJson, d);
    await prisma.paymentProviderConfig.upsert({
      where: {
        provider_label: {
          provider: d.provider,
          label: d.label,
        },
      },
      create: {
        provider: d.provider,
        label: d.label,
        enabled: d.enabled,
        isDefault: d.isDefault,
        configJson: merged,
      },
      update: {
        provider: d.provider,
        label: d.label,
        enabled: d.enabled,
        isDefault: d.isDefault,
        configJson: merged,
      },
    });
  }

  revalidatePath("/admin/settings");
}

/** @deprecated use savePaymentProviderConfig */
export async function upsertPaymentProviderConfig(formData: FormData) {
  return savePaymentProviderConfig(formData);
}

export async function deletePaymentProviderConfig(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id");
  const parsed = z.string().cuid().safeParse(id);
  if (!parsed.success) return;

  await prisma.paymentProviderConfig.delete({
    where: { id: parsed.data },
  });
  revalidatePath("/admin/settings");
}
