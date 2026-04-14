"use server";

import { ReceiptTemplateScope } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { RECEIPT_DEFAULTS } from "@/lib/receipt-template";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  scope: z.nativeEnum(ReceiptTemplateScope),
  companyName: z.string().min(2).max(120),
  heading: z.string().min(2).max(160),
  subheading: z.string().min(2).max(160),
  contactPhone: z.string().min(4).max(180),
  contactEmail: z.string().email().max(180),
  officeAddress: z.string().min(2).max(180),
  disclaimer: z.string().min(8).max(2000),
  thankYouNote: z.string().min(4).max(300),
  signatureLabel: z.string().min(2).max(120),
  accentColor: z.string().regex(/^#?[0-9a-fA-F]{6}$/),
  showSignature: z.preprocess((v) => v === "on" || v === "true", z.boolean()).default(false),
});

export async function saveReceiptTemplate(formData: FormData) {
  await requireAdmin();
  const parsed = schema.safeParse({
    scope: formData.get("scope"),
    companyName: String(formData.get("companyName") ?? "").trim(),
    heading: String(formData.get("heading") ?? "").trim(),
    subheading: String(formData.get("subheading") ?? "").trim(),
    contactPhone: String(formData.get("contactPhone") ?? "").trim(),
    contactEmail: String(formData.get("contactEmail") ?? "").trim(),
    officeAddress: String(formData.get("officeAddress") ?? "").trim(),
    disclaimer: String(formData.get("disclaimer") ?? "").trim(),
    thankYouNote: String(formData.get("thankYouNote") ?? "").trim(),
    signatureLabel: String(formData.get("signatureLabel") ?? "").trim(),
    accentColor: String(formData.get("accentColor") ?? "").trim(),
    showSignature: formData.get("showSignature"),
  });
  if (!parsed.success) return;
  const d = parsed.data;

  await prisma.receiptTemplateConfig.upsert({
    where: { scope: d.scope },
    create: {
      ...d,
      accentColor: d.accentColor.startsWith("#") ? d.accentColor : `#${d.accentColor}`,
    },
    update: {
      ...d,
      accentColor: d.accentColor.startsWith("#") ? d.accentColor : `#${d.accentColor}`,
    },
  });
  revalidatePath("/admin/settings/receipt-template");
}

export async function resetReceiptTemplate(formData: FormData) {
  await requireAdmin();
  const parsed = z.nativeEnum(ReceiptTemplateScope).safeParse(formData.get("scope"));
  if (!parsed.success) return;
  const scope = parsed.data;
  await prisma.receiptTemplateConfig.upsert({
    where: { scope },
    create: { scope, ...RECEIPT_DEFAULTS[scope] },
    update: { ...RECEIPT_DEFAULTS[scope] },
  });
  revalidatePath("/admin/settings/receipt-template");
}
