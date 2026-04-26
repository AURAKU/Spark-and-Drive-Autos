"use server";

import {
  DisputeCaseStatus,
  DisputeCaseType,
  DisputeEvidenceType,
  DisputePriority,
  PaymentStatus,
  RiskTagSeverity,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/sanitize";
import { addDisputeTimeline, collectSystemEvidence, createDisputeCase, logDisputeAction } from "@/lib/disputes";
import { transitionPaymentStatus } from "@/lib/payment-lifecycle";

const caseTypeSchema = z.nativeEnum(DisputeCaseType);
const statusSchema = z.nativeEnum(DisputeCaseStatus);
const prioritySchema = z.nativeEnum(DisputePriority);
const paymentStatusSchema = z.nativeEnum(PaymentStatus);
const evidenceTypeSchema = z.nativeEnum(DisputeEvidenceType);

async function getMutableDisputeOrThrow(disputeId: string) {
  const dispute = await prisma.disputeCase.findUnique({
    where: { id: disputeId },
    select: { id: true, status: true },
  });
  if (!dispute) throw new Error("Dispute not found.");
  if (dispute.status === DisputeCaseStatus.CLOSED) {
    throw new Error("Closed disputes are locked from further action.");
  }
  return dispute;
}

function revalidateDisputePaths(id?: string) {
  revalidatePath("/admin/disputes");
  revalidatePath("/admin/payments/intelligence");
  revalidatePath("/admin/legal");
  if (id) revalidatePath(`/admin/disputes/${id}`);
}

export async function openDisputeCaseAction(formData: FormData): Promise<void> {
  try {
    const admin = await requireAdmin();
    const parsed = z
      .object({
        type: caseTypeSchema,
        priority: prioritySchema.optional(),
        userId: z.string().cuid().optional(),
        paymentId: z.string().cuid().optional(),
        orderId: z.string().cuid().optional(),
        receiptId: z.string().cuid().optional(),
        sourcingRequestId: z.string().cuid().optional(),
        partsFinderSessionId: z.string().cuid().optional(),
        amount: z.coerce.number().nonnegative().optional(),
        currency: z.string().trim().min(3).max(8).optional(),
        reason: z.string().trim().min(8).max(4000),
        customerClaim: z.string().trim().max(6000).optional(),
        adminSummary: z.string().trim().max(6000).optional(),
      })
      .safeParse({
        type: formData.get("type"),
        priority: formData.get("priority") || undefined,
        userId: formData.get("userId") || undefined,
        paymentId: formData.get("paymentId") || undefined,
        orderId: formData.get("orderId") || undefined,
        receiptId: formData.get("receiptId") || undefined,
        sourcingRequestId: formData.get("sourcingRequestId") || undefined,
        partsFinderSessionId: formData.get("partsFinderSessionId") || undefined,
        amount: formData.get("amount") || undefined,
        currency: formData.get("currency") || undefined,
        reason: formData.get("reason"),
        customerClaim: formData.get("customerClaim") || undefined,
        adminSummary: formData.get("adminSummary") || undefined,
      });
    if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(" "));

    const created = await createDisputeCase({
      type: parsed.data.type as DisputeCaseType,
      priority: parsed.data.priority as DisputePriority | undefined,
      userId: parsed.data.userId ?? null,
      paymentId: parsed.data.paymentId ?? null,
      orderId: parsed.data.orderId ?? null,
      receiptId: parsed.data.receiptId ?? null,
      sourcingRequestId: parsed.data.sourcingRequestId ?? null,
      partsFinderSessionId: parsed.data.partsFinderSessionId ?? null,
      amount: parsed.data.amount ?? null,
      currency: parsed.data.currency ? sanitizePlainText(parsed.data.currency, 8).toUpperCase() : null,
      reason: sanitizePlainText(parsed.data.reason, 4000),
      customerClaim: parsed.data.customerClaim ? sanitizePlainText(parsed.data.customerClaim, 6000) : null,
      adminSummary: parsed.data.adminSummary ? sanitizePlainText(parsed.data.adminSummary, 6000) : null,
      createdById: admin.user.id,
    });
    revalidateDisputePaths(created.id);
  } catch (e) {
    console.error("[openDisputeCaseAction]", e);
    throw new Error("Could not open dispute case.");
  }
}

export async function collectDisputeEvidenceAction(formData: FormData): Promise<void> {
  try {
    const admin = await requireAdmin();
    const disputeId = z.string().cuid().safeParse(formData.get("disputeId"));
    if (!disputeId.success) throw new Error("Invalid dispute.");
    await getMutableDisputeOrThrow(disputeId.data);
    await collectSystemEvidence(disputeId.data, admin.user.id);
    revalidateDisputePaths(disputeId.data);
  } catch (e) {
    console.error("[collectDisputeEvidenceAction]", e);
    throw new Error("Could not collect evidence.");
  }
}

export async function updateDisputeStatusAction(formData: FormData): Promise<void> {
  try {
    const admin = await requireAdmin();
    const parsed = z
      .object({
        disputeId: z.string().cuid(),
        status: statusSchema,
        note: z.string().trim().max(4000).optional(),
      })
      .safeParse({
        disputeId: formData.get("disputeId"),
        status: formData.get("status"),
        note: formData.get("note") || undefined,
      });
    if (!parsed.success) throw new Error("Invalid status update.");
    const before = await getMutableDisputeOrThrow(parsed.data.disputeId);
    const next = parsed.data.status;
    if (
      (next === DisputeCaseStatus.RESOLVED_APPROVED || next === DisputeCaseStatus.RESOLVED_REJECTED || next === DisputeCaseStatus.REFUNDED) &&
      !parsed.data.note
    ) {
      throw new Error("Resolution note is required for resolved/refunded states.");
    }
    await prisma.disputeCase.update({
      where: { id: parsed.data.disputeId },
      data: {
        status: next,
        resolvedAt:
          next === DisputeCaseStatus.RESOLVED_APPROVED ||
          next === DisputeCaseStatus.RESOLVED_REJECTED ||
          next === DisputeCaseStatus.REFUNDED ||
          next === DisputeCaseStatus.CLOSED
            ? new Date()
            : null,
      },
    });
    await addDisputeTimeline({
      disputeId: parsed.data.disputeId,
      actorId: admin.user.id,
      action: "STATUS_CHANGED",
      oldStatus: before.status,
      newStatus: next,
      note: parsed.data.note ? sanitizePlainText(parsed.data.note, 4000) : null,
    });
    await logDisputeAction({
      disputeId: parsed.data.disputeId,
      actorId: admin.user.id,
      action: "STATUS_CHANGED",
      metadata: { oldStatus: before.status, newStatus: next },
    });
    revalidateDisputePaths(parsed.data.disputeId);
  } catch (e) {
    console.error("[updateDisputeStatusAction]", e);
    throw new Error("Could not update status.");
  }
}

export async function assignDisputeAction(formData: FormData): Promise<void> {
  try {
    const admin = await requireAdmin();
    const parsed = z
      .object({
        disputeId: z.string().cuid(),
        assignedToId: z.string().cuid().nullable(),
      })
      .safeParse({
        disputeId: formData.get("disputeId"),
        assignedToId: formData.get("assignedToId") ? String(formData.get("assignedToId")) : null,
      });
    if (!parsed.success) throw new Error("Invalid assignment.");
    await getMutableDisputeOrThrow(parsed.data.disputeId);
    if (parsed.data.assignedToId) {
      const assignee = await prisma.user.findUnique({
        where: { id: parsed.data.assignedToId },
        select: { id: true, role: true },
      });
      if (!assignee || assignee.role === "CUSTOMER") {
        throw new Error("Assignee must be a valid admin/staff user.");
      }
    }
    await prisma.disputeCase.update({
      where: { id: parsed.data.disputeId },
      data: { assignedToId: parsed.data.assignedToId ?? null },
    });
    await logDisputeAction({
      disputeId: parsed.data.disputeId,
      actorId: admin.user.id,
      action: "ASSIGNMENT_CHANGED",
      metadata: { assignedToId: parsed.data.assignedToId },
    });
    revalidateDisputePaths(parsed.data.disputeId);
  } catch (e) {
    console.error("[assignDisputeAction]", e);
    throw new Error("Could not assign case.");
  }
}

export async function updateDisputePriorityAction(formData: FormData): Promise<void> {
  try {
    const admin = await requireAdmin();
    const parsed = z
      .object({
        disputeId: z.string().cuid(),
        priority: prioritySchema,
      })
      .safeParse({ disputeId: formData.get("disputeId"), priority: formData.get("priority") });
    if (!parsed.success) throw new Error("Invalid priority.");
    await getMutableDisputeOrThrow(parsed.data.disputeId);
    await prisma.disputeCase.update({ where: { id: parsed.data.disputeId }, data: { priority: parsed.data.priority as DisputePriority } });
    await logDisputeAction({
      disputeId: parsed.data.disputeId,
      actorId: admin.user.id,
      action: "PRIORITY_CHANGED",
      metadata: { priority: parsed.data.priority },
    });
    revalidateDisputePaths(parsed.data.disputeId);
  } catch (e) {
    console.error("[updateDisputePriorityAction]", e);
    throw new Error("Could not update priority.");
  }
}

export async function addDisputeEvidenceAction(formData: FormData): Promise<void> {
  try {
    const admin = await requireAdmin();
    const parsed = z
      .object({
        disputeId: z.string().cuid(),
        evidenceType: evidenceTypeSchema,
        title: z.string().trim().min(2).max(180),
        description: z.string().trim().max(6000).optional(),
        fileUrl: z.string().url().optional(),
      })
      .safeParse({
        disputeId: formData.get("disputeId"),
        evidenceType: formData.get("evidenceType"),
        title: formData.get("title"),
        description: formData.get("description") || undefined,
        fileUrl: formData.get("fileUrl") || undefined,
      });
    if (!parsed.success) throw new Error("Invalid evidence.");
    await getMutableDisputeOrThrow(parsed.data.disputeId);
    await prisma.disputeEvidence.create({
      data: {
        disputeId: parsed.data.disputeId,
        evidenceType: parsed.data.evidenceType,
        title: sanitizePlainText(parsed.data.title, 180),
        description: parsed.data.description ? sanitizePlainText(parsed.data.description, 6000) : null,
        fileUrl: parsed.data.fileUrl ?? null,
        addedById: admin.user.id,
      },
    });
    await addDisputeTimeline({
      disputeId: parsed.data.disputeId,
      actorId: admin.user.id,
      action: "EVIDENCE_ADDED",
      note: parsed.data.title,
      metadata: { evidenceType: parsed.data.evidenceType },
    });
    revalidateDisputePaths(parsed.data.disputeId);
  } catch (e) {
    console.error("[addDisputeEvidenceAction]", e);
    throw new Error("Could not add evidence.");
  }
}

const ALLOWED_DISPUTE_RISK_TAGS = [
  "DISPUTE_HISTORY",
  "PAYMENT_VERIFICATION_REQUIRED",
  "MANUAL_REVIEW_REQUIRED",
  "REFUND_REVIEW_REQUIRED",
  "FRAUD_RISK_REVIEW",
] as const;

export async function applyDisputeRiskTagAction(formData: FormData): Promise<void> {
  try {
    const admin = await requireAdmin();
    const parsed = z
      .object({
        disputeId: z.string().cuid(),
        userId: z.string().cuid(),
        tag: z.enum(ALLOWED_DISPUTE_RISK_TAGS),
        note: z.string().trim().max(500).optional(),
      })
      .safeParse({
        disputeId: formData.get("disputeId"),
        userId: formData.get("userId"),
        tag: formData.get("tag"),
        note: formData.get("note") || undefined,
      });
    if (!parsed.success) throw new Error("Invalid risk tag request.");
    await getMutableDisputeOrThrow(parsed.data.disputeId);
    const existing = await prisma.userRiskTag.findFirst({
      where: {
        userId: parsed.data.userId,
        tag: parsed.data.tag,
        isActive: true,
      },
      select: { id: true },
    });
    if (existing) {
      throw new Error("This active risk tag is already applied.");
    }
    await prisma.userRiskTag.create({
      data: {
        userId: parsed.data.userId,
        tag: parsed.data.tag,
        note: parsed.data.note ? sanitizePlainText(parsed.data.note, 500) : null,
        severity: parsed.data.tag === "FRAUD_RISK_REVIEW" ? RiskTagSeverity.CRITICAL : RiskTagSeverity.HIGH,
        createdById: admin.user.id,
      },
    });
    await logDisputeAction({
      disputeId: parsed.data.disputeId,
      actorId: admin.user.id,
      action: "RISK_TAG_APPLIED",
      metadata: { tag: parsed.data.tag, userId: parsed.data.userId },
    });
    revalidateDisputePaths(parsed.data.disputeId);
  } catch (e) {
    console.error("[applyDisputeRiskTagAction]", e);
    throw new Error("Could not apply risk tag.");
  }
}

export async function resolveDisputePaymentAction(formData: FormData): Promise<void> {
  try {
    const admin = await requireAdmin();
    const parsed = z
      .object({
        disputeId: z.string().cuid(),
        paymentId: z.string().cuid(),
        paymentStatus: paymentStatusSchema,
        resolution: z.string().trim().min(8).max(5000),
      })
      .safeParse({
        disputeId: formData.get("disputeId"),
        paymentId: formData.get("paymentId"),
        paymentStatus: formData.get("paymentStatus"),
        resolution: formData.get("resolution"),
      });
    if (!parsed.success) throw new Error("Invalid resolution payload.");
    const linked = await prisma.disputeCase.findUnique({
      where: { id: parsed.data.disputeId },
      select: { id: true, paymentId: true, status: true },
    });
    if (!linked) throw new Error("Dispute not found.");
    if (linked.status === DisputeCaseStatus.CLOSED) {
      throw new Error("Closed disputes are locked from payment resolution.");
    }
    if (!linked.paymentId || linked.paymentId !== parsed.data.paymentId) {
      throw new Error("Payment does not match the linked dispute payment.");
    }
    const payment = await prisma.payment.findUnique({
      where: { id: parsed.data.paymentId },
      select: { id: true, status: true },
    });
    if (!payment) throw new Error("Payment not found.");

    await transitionPaymentStatus(parsed.data.paymentId, {
      toStatus: parsed.data.paymentStatus,
      source: "ADMIN_DISPUTE_RESOLUTION",
      actorUserId: admin.user.id,
      note: sanitizePlainText(parsed.data.resolution, 5000),
    });

    await prisma.disputeCase.update({
      where: { id: parsed.data.disputeId },
      data: {
        resolution: sanitizePlainText(parsed.data.resolution, 5000),
        status:
          parsed.data.paymentStatus === PaymentStatus.REFUNDED
            ? DisputeCaseStatus.REFUNDED
            : DisputeCaseStatus.RESOLVED_APPROVED,
        resolvedAt: new Date(),
      },
    });
    await addDisputeTimeline({
      disputeId: parsed.data.disputeId,
      actorId: admin.user.id,
      action: "PAYMENT_RESOLVED",
      oldStatus: linked.status,
      newStatus:
        parsed.data.paymentStatus === PaymentStatus.REFUNDED
          ? DisputeCaseStatus.REFUNDED
          : DisputeCaseStatus.RESOLVED_APPROVED,
      note: parsed.data.resolution,
      metadata: { paymentStatus: parsed.data.paymentStatus, previousPaymentStatus: payment.status },
    });
    await logDisputeAction({
      disputeId: parsed.data.disputeId,
      actorId: admin.user.id,
      action: "PAYMENT_RESOLVED",
      metadata: { paymentStatus: parsed.data.paymentStatus },
    });
    revalidateDisputePaths(parsed.data.disputeId);
  } catch (e) {
    console.error("[resolveDisputePaymentAction]", e);
    throw new Error("Could not resolve payment for dispute.");
  }
}
