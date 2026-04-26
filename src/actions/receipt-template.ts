"use server";

import { ReceiptType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { RECEIPT_DEFAULTS } from "@/lib/receipt-template";
import { prisma } from "@/lib/prisma";
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

  const latest = await prisma.receiptTemplate.findFirst({
    where: { type: d.type },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (latest?.version ?? 0) + 1;
  await prisma.$transaction(async (tx) => {
    await tx.receiptTemplate.updateMany({
      where: { type: d.type, isActive: true },
      data: { isActive: false },
    });
    const created = await tx.receiptTemplate.create({
      data: {
        ...d,
        version,
        accentColor: d.accentColor.startsWith("#") ? d.accentColor : `#${d.accentColor}`,
        name: `${d.type} v${version}`,
        isActive: true,
        createdById: admin.user.id,
      },
    });
    await tx.receiptAuditLog.create({
      data: {
        templateId: created.id,
        actorId: admin.user.id,
        action: "RECEIPT_TEMPLATE_CREATED",
        metadata: { type: d.type, version },
      },
    });
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
  const latest = await prisma.receiptTemplate.findFirst({
    where: { type },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (latest?.version ?? 0) + 1;

  await prisma.$transaction(async (tx) => {
    await tx.receiptTemplate.updateMany({
      where: { type, isActive: true },
      data: { isActive: false },
    });
    const created = await tx.receiptTemplate.create({
      data: {
        type,
        version,
        ...RECEIPT_DEFAULTS[type],
        createdById: admin.user.id,
      },
    });
    await tx.receiptAuditLog.create({
      data: {
        templateId: created.id,
        actorId: admin.user.id,
        action: "RECEIPT_TEMPLATE_RESET_DEFAULT",
        metadata: { type, version },
      },
    });
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
