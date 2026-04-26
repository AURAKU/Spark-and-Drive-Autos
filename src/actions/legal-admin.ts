"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PaymentDisputeStatus, PaymentStatus, Prisma, RiskTagSeverity } from "@prisma/client";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { writeLegalAuditLog } from "@/lib/legal-audit";
import { DEFAULT_PAYMENT_DISPUTE_NOTE } from "@/lib/legal-enforcement";
import { hasPaymentSuccessEvidence } from "@/lib/legal-payment-evidence";
import { transitionPaymentStatus } from "@/lib/payment-lifecycle";
import { prisma } from "@/lib/prisma";
import { logRiskEvent } from "@/lib/risk-engine";
import { writeAuditLog } from "@/lib/audit";

const INTERNAL_RISK_TAGS = [
  "MANUAL_REVIEW_REQUIRED",
  "PAYMENT_VERIFICATION_REQUIRED",
  "DISPUTE_HISTORY",
  "HIGH_VALUE_TRANSACTION",
  "FRAUD_RISK_REVIEW",
  "REFUND_REVIEW_REQUIRED",
  "SOURCING_RISK_REVIEW",
  "ACCOUNT_SECURITY_REVIEW",
] as const;

const policySchema = z.object({
  policyKey: z.string().min(2).max(80),
  version: z.string().min(1).max(40),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(100_000),
  isActive: z.boolean().optional(),
});

function sanitizePolicyBodyHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .trim();
}

export async function createPolicyVersion(formData: FormData) {
  const session = await requireAdmin();
  const parsed = policySchema.safeParse({
    policyKey: formData.get("policyKey"),
    version: formData.get("version"),
    title: formData.get("title"),
    content: formData.get("content"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    redirect("/admin/legal?err=policy");
  }
  const d = parsed.data;
  const safeBody = sanitizePolicyBodyHtml(d.content);
  if (d.isActive) {
    await prisma.policyVersion.updateMany({
      where: { policyKey: d.policyKey },
      data: { isActive: false },
    });
  }
  let created;
  try {
    created = await prisma.policyVersion.create({
      data: {
        policyKey: d.policyKey,
        version: d.version,
        title: d.title,
        content: safeBody,
        isActive: d.isActive ?? true,
        createdById: session.user.id,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      redirect(
        `/admin/legal?err=policy_unique&policyKey=${encodeURIComponent(d.policyKey)}&policyVersion=${encodeURIComponent(d.version)}`,
      );
    }
    throw e;
  }
  await writeLegalAuditLog({
    actorId: session.user.id,
    action: d.isActive ?? true ? "POLICY_VERSION_CREATED_AND_ACTIVATED" : "POLICY_VERSION_CREATED",
    entityType: "PolicyVersion",
    entityId: created.id,
    metadata: { policyKey: d.policyKey, version: d.version, isActive: d.isActive ?? true },
  });
  await writeAuditLog({
    actorId: session.user.id,
    action: "LEGAL_POLICY_VERSION_CREATE",
    entityType: "PolicyVersion",
    entityId: created.id,
    metadataJson: { policyKey: d.policyKey, version: d.version, isActive: d.isActive ?? true },
  });
  revalidatePath("/admin/legal");
  redirect(`/admin/legal?policyVersionId=${encodeURIComponent(created.id)}&saved=1`);
}

export async function activatePolicyVersionAction(formData: FormData) {
  const session = await requireAdmin();
  const id = z.string().cuid().safeParse(String(formData.get("policyVersionId") ?? ""));
  if (!id.success) redirect("/admin/legal?err=activate");
  const row = await prisma.policyVersion.findUnique({ where: { id: id.data } });
  if (!row) redirect("/admin/legal?err=activate");
  await prisma.policyVersion.updateMany({ where: { policyKey: row.policyKey }, data: { isActive: false } });
  await prisma.policyVersion.update({ where: { id: id.data }, data: { isActive: true } });
  await writeLegalAuditLog({
    actorId: session.user.id,
    action: "POLICY_ACTIVATED",
    entityType: "PolicyVersion",
    entityId: id.data,
    metadata: { policyKey: row.policyKey, version: row.version },
  });
  revalidatePath("/admin/legal");
  redirect(`/admin/legal?policyVersionId=${encodeURIComponent(id.data)}&activated=1`);
}

const contractSchema = z.object({
  type: z.string().min(2).max(80),
  title: z.string().max(200).optional(),
  version: z.string().min(1).max(40),
  content: z.string().min(20).max(100_000),
  isActive: z.boolean().optional(),
});

export async function createContractVersion(formData: FormData) {
  const session = await requireAdmin();
  const parsed = contractSchema.safeParse({
    type: formData.get("type"),
    title: formData.get("title") || undefined,
    version: formData.get("version"),
    content: formData.get("content"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    redirect("/admin/legal?err=contract");
  }
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
      title: d.title?.trim() || null,
      version: d.version,
      content: d.content,
      isActive: d.isActive ?? true,
      createdById: session.user.id,
    },
  });
  await writeLegalAuditLog({
    actorId: session.user.id,
    action: d.isActive ?? true ? "CONTRACT_CREATED_AND_ACTIVATED" : "CONTRACT_CREATED",
    entityType: "Contract",
    entityId: created.id,
    metadata: { type: d.type, version: d.version, isActive: d.isActive ?? true },
  });
  await writeAuditLog({
    actorId: session.user.id,
    action: "LEGAL_CONTRACT_CREATE",
    entityType: "Contract",
    entityId: created.id,
    metadataJson: { type: d.type, version: d.version, isActive: d.isActive ?? true },
  });
  revalidatePath("/admin/legal");
  redirect(`/admin/legal?contractId=${encodeURIComponent(created.id)}&saved=1`);
}

export async function activateContractVersionAction(formData: FormData) {
  const session = await requireAdmin();
  const id = z.string().cuid().safeParse(String(formData.get("contractId") ?? ""));
  if (!id.success) redirect("/admin/legal?err=activate");
  const row = await prisma.contract.findUnique({ where: { id: id.data } });
  if (!row) redirect("/admin/legal?err=activate");
  await prisma.contract.updateMany({ where: { type: row.type }, data: { isActive: false } });
  await prisma.contract.update({ where: { id: id.data }, data: { isActive: true } });
  await writeLegalAuditLog({
    actorId: session.user.id,
    action: "CONTRACT_ACTIVATED",
    entityType: "Contract",
    entityId: id.data,
    metadata: { type: row.type, version: row.version },
  });
  revalidatePath("/admin/legal");
  redirect(`/admin/legal?contractId=${encodeURIComponent(id.data)}&activated=1`);
}

const paymentControlSchema = z.object({
  paymentId: z.string().cuid(),
  toStatus: z.nativeEnum(PaymentStatus).optional(),
  disputed: z.boolean().optional(),
  disputeReason: z.string().max(4000).optional(),
  evidenceNotes: z.string().max(8000).optional(),
});

export async function updatePaymentLegalControl(formData: FormData) {
  const session = await requireAdmin();
  const parsed = paymentControlSchema.safeParse({
    paymentId: formData.get("paymentId"),
    toStatus: formData.get("toStatus") || undefined,
    disputed: formData.get("disputed") === "on",
    disputeReason: formData.get("disputeReason") || undefined,
    evidenceNotes: formData.get("evidenceNotes") || undefined,
  });
  if (!parsed.success) {
    redirect("/admin/legal?err=payment");
  }
  const d = parsed.data;

  if (d.toStatus === "SUCCESS") {
    const ok = await hasPaymentSuccessEvidence(d.paymentId);
    if (!ok) {
      redirect("/admin/legal?err=payment_evidence&paymentId=" + encodeURIComponent(d.paymentId));
    }
  }

  const disputeNote = (d.evidenceNotes ?? d.disputeReason)?.trim() || DEFAULT_PAYMENT_DISPUTE_NOTE;

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

  if (d.disputed) {
    const pay = await prisma.payment.findUnique({ where: { id: d.paymentId }, select: { userId: true } });
    const disputeStatus: PaymentDisputeStatus =
      d.toStatus === "UNDER_REVIEW" ? PaymentDisputeStatus.UNDER_REVIEW : PaymentDisputeStatus.OPEN;
    await prisma.paymentDispute.create({
      data: {
        paymentId: d.paymentId,
        reason: d.disputeReason ?? null,
        evidenceNotes: disputeNote,
        status: disputeStatus,
        flaggedById: session.user.id,
      },
    });
    await writeLegalAuditLog({
      actorId: session.user.id,
      targetUserId: pay?.userId ?? null,
      action: "PAYMENT_DISPUTE_FLAGGED",
      entityType: "Payment",
      entityId: d.paymentId,
      metadata: { disputeStatus, reason: d.disputeReason ?? null },
    });
  }

  if (d.toStatus) {
    await transitionPaymentStatus(d.paymentId, {
      toStatus: d.toStatus,
      source: "ADMIN",
      actorUserId: session.user.id,
      note: d.disputed ? `Dispute flagged: ${d.disputeReason ?? "No reason provided"}` : "Payment status updated from legal panel",
      review: { reviewedById: session.user.id, reviewedAt: new Date() },
    });
  }

  await writeLegalAuditLog({
    actorId: session.user.id,
    action: "LEGAL_PAYMENT_CONTROL",
    entityType: "Payment",
    entityId: d.paymentId,
    metadata: {
      toStatus: d.toStatus ?? null,
      disputed: Boolean(d.disputed),
      disputeReason: d.disputeReason ?? null,
    },
  });
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
  redirect(`/admin/legal?paymentId=${encodeURIComponent(d.paymentId)}&paymentSaved=1`);
}

const riskTagSchema = z.object({
  userId: z.string().min(3).max(320),
  tag: z.enum(INTERNAL_RISK_TAGS),
  note: z.string().max(2000).optional(),
  severity: z.nativeEnum(RiskTagSeverity),
});

export async function createUserRiskTag(formData: FormData) {
  const session = await requireAdmin();
  const parsed = riskTagSchema.safeParse({
    userId: formData.get("userId"),
    tag: formData.get("tag"),
    note: formData.get("note") || undefined,
    severity: formData.get("severity") || RiskTagSeverity.MEDIUM,
  });
  if (!parsed.success) {
    redirect("/admin/legal?err=risk");
  }
  const d = parsed.data;
  const userInput = d.userId.trim();
  let targetUserId = "";
  if (/^c[a-z0-9]{24,}$/i.test(userInput)) {
    targetUserId = userInput;
  } else if (userInput.includes("@")) {
    const byEmail = await prisma.user.findUnique({
      where: { email: userInput.toLowerCase() },
      select: { id: true },
    });
    if (!byEmail) {
      redirect("/admin/legal?err=risk");
    }
    targetUserId = byEmail.id;
  } else {
    redirect("/admin/legal?err=risk");
  }

  const created = await prisma.userRiskTag.create({
    data: {
      userId: targetUserId,
      tag: d.tag,
      note: d.note ?? null,
      severity: d.severity,
      createdById: session.user.id,
      isActive: true,
      resolvedAt: null,
    },
  });
  await writeLegalAuditLog({
    actorId: session.user.id,
    targetUserId: targetUserId,
    action: "RISK_TAG_ADDED",
    entityType: "UserRiskTag",
    entityId: created.id,
    metadata: { tag: d.tag, severity: d.severity },
  });
  await writeAuditLog({
    actorId: session.user.id,
    action: "USER_RISK_TAG_CREATE",
    entityType: "UserRiskTag",
    entityId: created.id,
    metadataJson: { userId: targetUserId, tag: d.tag },
  });
  await logRiskEvent({
    userId: targetUserId,
    type: "manual_risk_tag",
    severity: "medium",
    meta: { tag: d.tag, note: d.note ?? null, createdById: session.user.id },
  });
  revalidatePath("/admin/legal");
  revalidatePath("/admin/users");
  redirect(`/admin/legal?riskTagId=${encodeURIComponent(created.id)}&riskSaved=1`);
}

export async function resolveUserRiskTag(formData: FormData) {
  const session = await requireAdmin();
  const parsed = z.string().cuid().safeParse(String(formData.get("riskTagId") ?? ""));
  if (!parsed.success) {
    redirect("/admin/legal?err=risk");
  }
  const id = parsed.data;
  const before = await prisma.userRiskTag.findUnique({ where: { id }, select: { userId: true, tag: true } });
  if (!before) {
    redirect("/admin/legal?err=risk");
  }
  await prisma.userRiskTag.update({
    where: { id },
    data: { isActive: false, resolvedAt: new Date() },
  });
  await writeLegalAuditLog({
    actorId: session.user.id,
    targetUserId: before?.userId ?? null,
    action: "RISK_TAG_RESOLVED",
    entityType: "UserRiskTag",
    entityId: id,
    metadata: { tag: before?.tag ?? null },
  });
  await writeAuditLog({
    actorId: session.user.id,
    action: "USER_RISK_TAG_RESOLVE",
    entityType: "UserRiskTag",
    entityId: id,
  });
  revalidatePath("/admin/legal");
  redirect(`/admin/legal?riskTagId=${encodeURIComponent(id)}&riskResolved=1`);
}
