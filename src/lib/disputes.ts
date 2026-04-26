import {
  DisputeCaseStatus,
  DisputeEvidenceType,
  PaymentStatus,
  Prisma,
  type DisputeCaseType,
  type DisputePriority,
} from "@prisma/client";
import { randomUUID } from "node:crypto";

import { transitionPaymentStatus } from "@/lib/payment-lifecycle";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { writeLegalAuditLog } from "@/lib/legal-audit";

export async function logDisputeAction(input: {
  disputeId: string;
  actorId?: string | null;
  action: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
  tx?: Prisma.TransactionClient;
}) {
  const db = input.tx ?? prisma;
  await db.disputeActionLog.create({
    data: {
      disputeId: input.disputeId,
      actorId: input.actorId ?? null,
      action: input.action,
      metadata: input.metadata,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export async function addDisputeTimeline(input: {
  disputeId: string;
  actorId?: string | null;
  action: string;
  oldStatus?: DisputeCaseStatus | null;
  newStatus?: DisputeCaseStatus | null;
  note?: string | null;
  metadata?: Prisma.InputJsonValue;
  tx?: Prisma.TransactionClient;
}) {
  const db = input.tx ?? prisma;
  await db.disputeTimelineEvent.create({
    data: {
      disputeId: input.disputeId,
      actorId: input.actorId ?? null,
      action: input.action,
      oldStatus: input.oldStatus ?? null,
      newStatus: input.newStatus ?? null,
      note: input.note ?? null,
      metadata: input.metadata,
    },
  });
}

export async function createDisputeCase(input: {
  type: DisputeCaseType;
  priority?: DisputePriority;
  userId?: string | null;
  paymentId?: string | null;
  orderId?: string | null;
  receiptId?: string | null;
  sourcingRequestId?: string | null;
  partsFinderSessionId?: string | null;
  amount?: number | null;
  currency?: string | null;
  reason: string;
  customerClaim?: string | null;
  adminSummary?: string | null;
  assignedToId?: string | null;
  createdById?: string | null;
  dueAt?: Date | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const caseNumber = `SDD-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 6).toUpperCase()}`;
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.disputeCase.create({
      data: {
        caseNumber,
        type: input.type,
        status: DisputeCaseStatus.OPEN,
        priority: input.priority ?? "MEDIUM",
        userId: input.userId ?? null,
        paymentId: input.paymentId ?? null,
        orderId: input.orderId ?? null,
        receiptId: input.receiptId ?? null,
        sourcingRequestId: input.sourcingRequestId ?? null,
        partsFinderSessionId: input.partsFinderSessionId ?? null,
        amount: input.amount ?? null,
        currency: input.currency ?? null,
        reason: input.reason,
        customerClaim: input.customerClaim ?? null,
        adminSummary: input.adminSummary ?? null,
        assignedToId: input.assignedToId ?? null,
        createdById: input.createdById ?? null,
        dueAt: input.dueAt ?? null,
      },
    });
    await addDisputeTimeline({
      tx,
      disputeId: row.id,
      actorId: input.createdById,
      action: "DISPUTE_OPENED",
      newStatus: DisputeCaseStatus.OPEN,
      note: input.reason,
    });
    await logDisputeAction({
      tx,
      disputeId: row.id,
      actorId: input.createdById,
      action: "DISPUTE_OPENED",
      metadata: { type: input.type, priority: input.priority ?? "MEDIUM" },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    return row;
  });

  if (created.paymentId) {
    const payment = await prisma.payment.findUnique({
      where: { id: created.paymentId },
      select: { id: true, status: true, userId: true },
    });
    if (payment && payment.status !== PaymentStatus.DISPUTED) {
      await transitionPaymentStatus(payment.id, {
        toStatus: PaymentStatus.DISPUTED,
        source: "ADMIN_DISPUTE_OPEN",
        actorUserId: input.createdById ?? undefined,
        note: `Dispute case ${created.caseNumber} opened`,
      });
      await writeAuditLog({
        actorId: input.createdById ?? undefined,
        action: "PAYMENT_STATUS_CHANGED_FOR_DISPUTE",
        entityType: "Payment",
        entityId: payment.id,
        metadataJson: { caseNumber: created.caseNumber, oldStatus: payment.status, newStatus: "DISPUTED" },
      });
      await writeLegalAuditLog({
        actorId: input.createdById ?? null,
        targetUserId: payment.userId ?? null,
        action: "DISPUTE_OPENED",
        entityType: "DisputeCase",
        entityId: created.id,
        metadata: { caseNumber: created.caseNumber, paymentId: payment.id },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
    }
  }
  return created;
}

export async function collectSystemEvidence(disputeId: string, actorId?: string | null) {
  const dispute = await prisma.disputeCase.findUnique({
    where: { id: disputeId },
    include: {
      payment: true,
      order: true,
      receipt: true,
      user: true,
    },
  });
  if (!dispute) throw new Error("DISPUTE_NOT_FOUND");

  const payloads: Array<Prisma.DisputeEvidenceCreateManyInput> = [];
  if (dispute.paymentId && dispute.payment) {
    payloads.push({
      disputeId,
      evidenceType: DisputeEvidenceType.PAYMENT_VERIFICATION,
      title: "Payment status snapshot",
      description: `Payment ${dispute.payment.providerReference ?? dispute.payment.id} status ${dispute.payment.status}`,
      metadata: {
        paymentId: dispute.payment.id,
        status: dispute.payment.status,
        providerReference: dispute.payment.providerReference,
      },
      addedById: actorId ?? null,
    });
  }
  if (dispute.receiptId && dispute.receipt) {
    payloads.push({
      disputeId,
      evidenceType: DisputeEvidenceType.RECEIPT,
      title: "Receipt snapshot",
      description: `Receipt ${dispute.receipt.receiptNumber} (${dispute.receipt.status})`,
      fileUrl: dispute.receipt.pdfUrl,
      metadata: {
        receiptId: dispute.receipt.id,
        receiptNumber: dispute.receipt.receiptNumber,
        status: dispute.receipt.status,
      },
      addedById: actorId ?? null,
    });
  }
  if (dispute.orderId && dispute.order) {
    payloads.push({
      disputeId,
      evidenceType: DisputeEvidenceType.ORDER_RECORD,
      title: "Order snapshot",
      description: `Order ${dispute.order.reference} status ${dispute.order.orderStatus}`,
      metadata: {
        orderId: dispute.order.id,
        reference: dispute.order.reference,
        status: dispute.order.orderStatus,
      },
      addedById: actorId ?? null,
    });
  }
  if (dispute.userId) {
    const [policyRows, contractRows, identity] = await Promise.all([
      prisma.userPolicyAcceptance.findMany({
        where: { userId: dispute.userId },
        orderBy: { acceptedAt: "desc" },
        take: 12,
        include: { policyVersion: { select: { policyKey: true, version: true } } },
      }),
      prisma.contractAcceptance.findMany({
        where: { userId: dispute.userId },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.userVerification.findFirst({
        where: { userId: dispute.userId },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, documentType: true, reviewedAt: true, reviewedById: true },
      }),
    ]);
    if (policyRows.length) {
      payloads.push({
        disputeId,
        evidenceType: DisputeEvidenceType.POLICY_ACCEPTANCE,
        title: "Policy acceptance records",
        description: "Latest accepted policy versions",
        metadata: {
          items: policyRows.map((r) => ({
            policyKey: r.policyVersion.policyKey,
            version: r.policyVersion.version,
            acceptedAt: r.acceptedAt.toISOString(),
            context: r.context,
          })),
        },
        addedById: actorId ?? null,
      });
    }
    if (contractRows.length) {
      payloads.push({
        disputeId,
        evidenceType: DisputeEvidenceType.CONTRACT_ACCEPTANCE,
        title: "Contract acceptance records",
        description: "Latest accepted contract versions",
        metadata: {
          items: contractRows.map((r) => ({
            contractVersion: r.contractVersion,
            context: r.context,
            createdAt: r.createdAt.toISOString(),
          })),
        },
        addedById: actorId ?? null,
      });
    }
    if (identity) {
      payloads.push({
        disputeId,
        evidenceType: DisputeEvidenceType.IDENTITY_VERIFICATION,
        title: "Identity verification status",
        description: `Identity verification status: ${identity.status}`,
        metadata: {
          verificationId: identity.id,
          status: identity.status,
          documentType: identity.documentType,
          reviewedAt: identity.reviewedAt?.toISOString() ?? null,
          reviewedById: identity.reviewedById ?? null,
        },
        addedById: actorId ?? null,
      });
    }
  }
  if (dispute.partsFinderSessionId) {
    payloads.push({
      disputeId,
      evidenceType: DisputeEvidenceType.PARTS_FINDER_RESULT,
      title: "Parts Finder session linked",
      description: "Session attached for fitment and disclaimer audit.",
      metadata: { partsFinderSessionId: dispute.partsFinderSessionId },
      addedById: actorId ?? null,
    });
  }
  if (payloads.length) {
    await prisma.disputeEvidence.createMany({ data: payloads });
  }
  await prisma.disputeCase.update({
    where: { id: disputeId },
    data: { status: DisputeCaseStatus.EVIDENCE_COLLECTED },
  });
  await addDisputeTimeline({
    disputeId,
    actorId,
    action: "EVIDENCE_COLLECTED_AUTOMATICALLY",
    oldStatus: dispute.status,
    newStatus: DisputeCaseStatus.EVIDENCE_COLLECTED,
  });
  await logDisputeAction({
    disputeId,
    actorId,
    action: "EVIDENCE_COLLECTED_AUTOMATICALLY",
    metadata: { count: payloads.length },
  });
}
