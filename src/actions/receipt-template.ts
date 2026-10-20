"use server";

import { ReceiptType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { RECEIPT_DEFAULTS } from "@/lib/receipt-template";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintViolation } from "@/lib/prisma-unique";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  type: z.nativeEnum(ReceiptType),
  businessName: z.string().min(2).max(120),
  title: z.string().min(2).max(160),
  categoryLabel: z.string().min(2).max(120),
  phone: z.string().min(4).max(180),
  email: z.string().email().max(180),
  address: z.string().min(2).max(180),
  legalNote: z.string().min(8).max(3000),
  footerNote: z.string().min(4).max(400),
  signatureLabel: z.string().min(2).max(120),
  accentColor: z.string().regex(/^#?[0-9a-fA-F]{6}$/),
  showSignatureLine: z.preprocess((v) => v === "on" || v === "true", z.boolean()).default(false),
});

type TemplateContent = {
  businessName: string;
  title: string;
  categoryLabel: string;
  phone: string;
  email: string;
  address: string;
  legalNote: string;
  footerNote: string;
  signatureLabel: string;
  accentColor: string;
  showSignatureLine: boolean;
};

async function createNextTemplateVersion(input: {
  type: ReceiptType;
  actorId: string;
  content: TemplateContent;
  nameForVersion: (version: number) => string;
  auditAction: string;
}): Promise<number> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const latest = await tx.receiptTemplate.findFirst({
          where: { type: input.type },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        const nextVersion = (latest?.version ?? 0) + 1;
        await tx.receiptTemplate.updateMany({
          where: { type: input.type, isActive: true },
          data: { isActive: false },
        });
        const created = await tx.receiptTemplate.create({
          data: {
            type: input.type,
            version: nextVersion,
            name: input.nameForVersion(nextVersion),
            ...input.content,
            isActive: true,
            createdById: input.actorId,
          },
        });
        await tx.receiptAuditLog.create({
          data: {
            templateId: created.id,
            actorId: input.actorId,
            action: input.auditAction,
            metadata: { type: input.type, version: nextVersion },
          },
        });
        return nextVersion;
      });
    } catch (e) {
      lastError = e;
      if (!isUniqueConstraintViolation(e)) throw e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not create receipt template version");
}

export async function saveReceiptTemplate(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = schema.safeParse({
    type: formData.get("type"),
    businessName: String(formData.get("businessName") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    categoryLabel: String(formData.get("categoryLabel") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    legalNote: String(formData.get("legalNote") ?? "").trim(),
    footerNote: String(formData.get("footerNote") ?? "").trim(),
    signatureLabel: String(formData.get("signatureLabel") ?? "").trim(),
    accentColor: String(formData.get("accentColor") ?? "").trim(),
    showSignatureLine: formData.get("showSignatureLine"),
  });
  if (!parsed.success) return;
  const d = parsed.data;
  const accentColor = d.accentColor.startsWith("#") ? d.accentColor : `#${d.accentColor}`;

  const version = await createNextTemplateVersion({
    type: d.type,
    actorId: admin.user.id,
    auditAction: "RECEIPT_TEMPLATE_CREATED",
    nameForVersion: (v) => `${d.type} v${v}`,
    content: {
      businessName: d.businessName,
      title: d.title,
      categoryLabel: d.categoryLabel,
      phone: d.phone,
      email: d.email,
      address: d.address,
      legalNote: d.legalNote,
      footerNote: d.footerNote,
      signatureLabel: d.signatureLabel,
      accentColor,
      showSignatureLine: d.showSignatureLine,
    },
  });

  await writeAuditLog({
    actorId: admin.user.id,
    action: "RECEIPT_TEMPLATE_UPDATED",
    entityType: "ReceiptTemplate",
    metadataJson: { type: d.type, version },
  });
  revalidatePath("/admin/settings/receipt-template");
}

export async function activateReceiptTemplate(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("templateId") ?? "");
  if (!id) return;
  const template = await prisma.receiptTemplate.findUnique({
    where: { id },
    select: { id: true, type: true, version: true },
  });
  if (!template) return;
  await prisma.$transaction(async (tx) => {
    await tx.receiptTemplate.updateMany({
      where: { type: template.type, isActive: true },
      data: { isActive: false },
    });
    await tx.receiptTemplate.update({
      where: { id: template.id },
      data: { isActive: true },
    });
    await tx.receiptAuditLog.create({
      data: {
        templateId: template.id,
        actorId: admin.user.id,
        action: "RECEIPT_TEMPLATE_ACTIVATED",
        metadata: { type: template.type, version: template.version },
      },
    });
  });
  revalidatePath("/admin/settings/receipt-template");
}

export async function resetReceiptTemplate(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = z.nativeEnum(ReceiptType).safeParse(formData.get("type"));
  if (!parsed.success) return;
  const type = parsed.data;
  const defaults = RECEIPT_DEFAULTS[type];

  await createNextTemplateVersion({
    type,
    actorId: admin.user.id,
    auditAction: "RECEIPT_TEMPLATE_RESET_DEFAULT",
    nameForVersion: () => defaults.name,
    content: {
      businessName: defaults.businessName,
      title: defaults.title,
      categoryLabel: defaults.categoryLabel,
      phone: defaults.phone,
      email: defaults.email,
      address: defaults.address,
      legalNote: defaults.legalNote,
      footerNote: defaults.footerNote,
      signatureLabel: defaults.signatureLabel,
      accentColor: defaults.accentColor,
      showSignatureLine: defaults.showSignatureLine,
    },
  });
  revalidatePath("/admin/settings/receipt-template");
}

export async function voidReceiptAction(formData: FormData) {
  const admin = await requireAdmin();
  const receiptId = String(formData.get("receiptId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!receiptId || reason.length < 4) return;
  await prisma.generatedReceipt.update({
    where: { id: receiptId },
    data: {
      status: "VOIDED",
      voidReason: reason,
      voidedAt: new Date(),
    },
  });
  await prisma.receiptAuditLog.create({
    data: {
      receiptId,
      actorId: admin.user.id,
      action: "RECEIPT_VOIDED",
      metadata: { reason },
    },
  });
  revalidatePath("/admin/settings/receipt-template");
  revalidatePath("/admin/receipts");
}
