"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { transitionPaymentStatus } from "@/lib/payment-lifecycle";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { logRiskEvent } from "@/lib/risk-engine";

const policySchema = z.object({
  policyKey: z.string().min(2).max(80),
  version: z.string().min(1).max(40),
  title: z.string().max(140).optional(),
  content: z.string().max(20000).optional(),
  isActive: z.boolean().optional(),
});

export async function createPolicyVersion(formData: FormData) {
  const session = await requireAdmin();
  const parsed = policySchema.safeParse({
    policyKey: formData.get("policyKey"),
    version: formData.get("version"),
    title: formData.get("title"),
    content: formData.get("content"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return;
  const d = parsed.data;
  if (d.isActive) {
    await prisma.policyVersion.updateMany({
      where: { policyKey: d.policyKey },
      data: { isActive: false },
    });
  }
  await prisma.policyVersion.create({
    data: {
      policyKey: d.policyKey,
      version: d.version,
      title: d.title ?? null,
      content: d.content ?? null,
      isActive: d.isActive ?? true,
      createdById: session.user.id,
    },
  });
  await writeAuditLog({
    actorId: session.user.id,
    action: "LEGAL_POLICY_VERSION_CREATE",
    entityType: "PolicyVersion",
    metadataJson: { policyKey: d.policyKey, version: d.version, isActive: d.isActive ?? true },
  });
  revalidatePath("/admin/legal");
}

const contractSchema = z.object({
  type: z.string().min(2).max(80),
  version: z.string().min(1).max(40),
  content: z.string().min(20).max(40000),
  isActive: z.boolean().optional(),
});

export async function createContractVersion(formData: FormData) {
  const session = await requireAdmin();
  const parsed = contractSchema.safeParse({
    type: formData.get("type"),
    version: formData.get("version"),
    content: formData.get("content"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return;
  const d = parsed.data;
  if (d.isActive) {
    await prisma.contract.updateMany({
      where: { type: d.type },
      data: { isActive: false },
    });
  }
  const created = await prisma.contract.create({
    data: {
      type: d.type,
      version: d.version,
      content: d.content,
      isActive: d.isActive ?? true,
    },
  });
  await writeAuditLog({
    actorId: session.user.id,
    action: "LEGAL_CONTRACT_CREATE",
    entityType: "Contract",
    entityId: created.id,
    metadataJson: { type: d.type, version: d.version, isActive: d.isActive ?? true },
  });
  revalidatePath("/admin/legal");
}

const paymentControlSchema = z.object({
  paymentId: z.string().cuid(),
  toStatus: z.enum(["PENDING", "PROCESSING", "AWAITING_PROOF", "FAILED", "SUCCESS"]).optional(),
  disputed: z.boolean().optional(),
  disputeReason: z.string().max(500).optional(),
});

export async function updatePaymentLegalControl(formData: FormData) {
  const session = await requireAdmin();
  const parsed = paymentControlSchema.safeParse({
    paymentId: formData.get("paymentId"),
    toStatus: formData.get("toStatus") || undefined,
    disputed: formData.get("disputed") === "on",
    disputeReason: formData.get("disputeReason") || undefined,
  });
  if (!parsed.success) return;
  const d = parsed.data;

  await prisma.paymentVerification.upsert({
    where: { paymentId: d.paymentId },
    create: {
      paymentId: d.paymentId,
      verified: false,
      disputed: Boolean(d.disputed),
      disputeReason: d.disputeReason ?? null,
      verificationSource: "ADMIN",
      verifiedById: session.user.id,
    },
    update: {
      disputed: Boolean(d.disputed),
      disputeReason: d.disputeReason ?? null,
      verificationSource: "ADMIN",
      verifiedById: session.user.id,
    },
  });

  if (d.toStatus) {
    await transitionPaymentStatus(d.paymentId, {
      toStatus: d.toStatus,
      source: "ADMIN",
      actorUserId: session.user.id,
      note: d.disputed ? `Dispute flagged: ${d.disputeReason ?? "No reason provided"}` : "Payment status updated from legal panel",
      review: { reviewedById: session.user.id, reviewedAt: new Date() },
    });
  }
  await writeAuditLog({
    actorId: session.user.id,
    action: "LEGAL_PAYMENT_CONTROL",
    entityType: "Payment",
    entityId: d.paymentId,
    metadataJson: { toStatus: d.toStatus ?? null, disputed: Boolean(d.disputed), disputeReason: d.disputeReason ?? null },
  });
  if (d.disputed) {
    const payment = await prisma.payment.findUnique({ where: { id: d.paymentId }, select: { userId: true } });
    if (payment?.userId) {
      await logRiskEvent({
        userId: payment.userId,
        type: "payment_dispute_flagged",
        severity: "high",
        meta: { paymentId: d.paymentId, reason: d.disputeReason ?? null },
      });
    }
  }
  revalidatePath("/admin/legal");
  revalidatePath("/admin/payments");
  revalidatePath(`/admin/payments/${d.paymentId}`);
}

const riskTagSchema = z.object({
  userId: z.string().cuid(),
  tag: z.string().min(2).max(80),
  note: z.string().max(500).optional(),
});

export async function createUserRiskTag(formData: FormData) {
  const session = await requireAdmin();
  const parsed = riskTagSchema.safeParse({
    userId: formData.get("userId"),
    tag: formData.get("tag"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return;
  const d = parsed.data;
  await prisma.userRiskTag.create({
    data: {
      userId: d.userId,
      tag: d.tag,
      note: d.note ?? null,
      createdById: session.user.id,
      isActive: true,
    },
  });
  await writeAuditLog({
    actorId: session.user.id,
    action: "USER_RISK_TAG_CREATE",
    entityType: "UserRiskTag",
    metadataJson: { userId: d.userId, tag: d.tag },
  });
  await logRiskEvent({
    userId: d.userId,
    type: "manual_risk_tag",
    severity: "medium",
    meta: { tag: d.tag, note: d.note ?? null, createdById: session.user.id },
  });
  revalidatePath("/admin/legal");
  revalidatePath("/admin/users");
}

export async function resolveUserRiskTag(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("riskTagId") ?? "");
  if (!id) return;
  await prisma.userRiskTag.update({ where: { id }, data: { isActive: false } });
  await writeAuditLog({
    actorId: session.user.id,
    action: "USER_RISK_TAG_RESOLVE",
    entityType: "UserRiskTag",
    entityId: id,
  });
  revalidatePath("/admin/legal");
}

