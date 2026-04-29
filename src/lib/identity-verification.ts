import {
  VerificationDocumentType,
  VerificationStatus,
  type Prisma,
} from "@prisma/client";

import { isAdminRole } from "@/auth";
import { prisma } from "@/lib/prisma";

export const ID_VERIFICATION_CONSENT_TEXT =
  "I consent to Spark & Drive Gear collecting and processing my identification document for payment verification, fraud prevention, dispute resolution, sourcing protection, and compliance purposes. I understand that my document will be stored securely and accessed only by authorized personnel.";

export const VERIFICATION_RISK_TAGS = [
  "FRAUD_RISK_REVIEW",
  "MANUAL_REVIEW_REQUIRED",
  "HIGH_VALUE_TRANSACTION",
  "PAYMENT_VERIFICATION_REQUIRED",
] as const;

/** Customer-facing allowed verification IDs (restricted product scope). */
export const ALLOWED_VERIFICATION_DOCUMENT_TYPES: VerificationDocumentType[] = [
  VerificationDocumentType.GHANA_CARD,
  VerificationDocumentType.PASSPORT,
  VerificationDocumentType.DRIVER_LICENSE,
];

export type VerificationContext =
  | "VEHICLE_PURCHASE"
  | "HIGH_VALUE_PAYMENT"
  | "SOURCING_DEPOSIT"
  | "MANUAL_PAYMENT"
  | "PAYMENT_DISPUTE"
  | "SUSPICIOUS_ACTIVITY"
  | "REFUND_REVIEW";

const DEFAULT_HIGH_VALUE_GHS = 20_000;

export function verificationHighValueThresholdGhs(): number {
  const raw = Number(process.env.IDENTITY_VERIFICATION_HIGH_VALUE_GHS ?? DEFAULT_HIGH_VALUE_GHS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_HIGH_VALUE_GHS;
}

export async function logVerificationAction(input: {
  userId: string;
  verificationId?: string | null;
  actorId?: string | null;
  action: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
  tx?: Prisma.TransactionClient;
}) {
  const client = input.tx ?? prisma;
  await client.verificationAuditLog.create({
    data: {
      userId: input.userId,
      verificationId: input.verificationId ?? null,
      actorId: input.actorId ?? null,
      action: input.action,
      metadata: input.metadata ?? undefined,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
  await client.legalAuditLog.create({
    data: {
      actorId: input.actorId ?? null,
      targetUserId: input.userId,
      action: input.action,
      entityType: "UserVerification",
      entityId: input.verificationId ?? null,
      metadata: (input.metadata ?? null) as Prisma.InputJsonValue | undefined,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export async function getUserVerificationStatus(userId: string) {
  const latest = await prisma.userVerification.findFirst({
    where: { userId },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      expiresAt: true,
      submittedAt: true,
      reviewedAt: true,
      rejectionReason: true,
      reason: true,
      documentType: true,
    },
  });
  if (!latest) {
    return {
      status: VerificationStatus.NOT_REQUIRED,
      verification: null,
    } as const;
  }
  if (latest.status === VerificationStatus.VERIFIED && latest.expiresAt && latest.expiresAt <= new Date()) {
    return {
      status: VerificationStatus.EXPIRED,
      verification: latest,
    } as const;
  }
  return {
    status: latest.status,
    verification: latest,
  } as const;
}

async function userHasRiskTagRequiringVerification(userId: string): Promise<boolean> {
  const rows = await prisma.userRiskTag.findMany({
    where: {
      userId,
      isActive: true,
      tag: { in: [...VERIFICATION_RISK_TAGS] },
    },
    select: { tag: true },
    take: 1,
  });
  return rows.length > 0;
}

export async function requireVerification(input: {
  userId: string;
  context: VerificationContext;
  amountGhs?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const riskTagged = await userHasRiskTagRequiringVerification(input.userId);
  const highValue =
    typeof input.amountGhs === "number" &&
    Number.isFinite(input.amountGhs) &&
    input.amountGhs >= verificationHighValueThresholdGhs();
  const alwaysRequiredContexts: VerificationContext[] = [
    "VEHICLE_PURCHASE",
    "SOURCING_DEPOSIT",
    "MANUAL_PAYMENT",
    "PAYMENT_DISPUTE",
    "REFUND_REVIEW",
  ];
  const shouldRequire = riskTagged || highValue || alwaysRequiredContexts.includes(input.context);
  if (!shouldRequire) {
    return { required: false, status: VerificationStatus.NOT_REQUIRED } as const;
  }

  const current = await getUserVerificationStatus(input.userId);
  if (current.status === VerificationStatus.VERIFIED) {
    return { required: true, status: VerificationStatus.VERIFIED, verification: current.verification } as const;
  }

  await logVerificationAction({
    userId: input.userId,
    verificationId: current.verification?.id,
    action: "VERIFICATION_REQUIRED_FOR_FLOW",
    metadata: {
      context: input.context,
      amountGhs: input.amountGhs ?? null,
      riskTagged,
      highValue,
      status: current.status,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  throw new Error("IDENTITY_VERIFICATION_REQUIRED");
}

export async function submitVerification(input: {
  userId: string;
  documentType: VerificationDocumentType;
  reason?: string | null;
  documentFrontUrl: string;
  documentBackUrl?: string | null;
  selfieUrl?: string | null;
  consentAccepted: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.userVerification.create({
      data: {
        userId: input.userId,
        documentType: input.documentType,
        status: VerificationStatus.PENDING,
        reason: input.reason ?? null,
        documentFrontUrl: input.documentFrontUrl,
        documentBackUrl: input.documentBackUrl ?? null,
        selfieUrl: input.selfieUrl ?? null,
        consentAccepted: input.consentAccepted,
        consentText: input.consentAccepted ? ID_VERIFICATION_CONSENT_TEXT : null,
      },
    });
    await logVerificationAction({
      tx,
      userId: input.userId,
      verificationId: created.id,
      action: "DOCUMENT_UPLOADED",
      metadata: {
        documentType: input.documentType,
        hasBack: Boolean(input.documentBackUrl),
        hasSelfie: Boolean(input.selfieUrl),
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    return created;
  });
  return row;
}

export async function approveVerification(input: {
  verificationId: string;
  adminId: string;
  expiresAt?: Date | null;
  internalNotes?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.userVerification.update({
      where: { id: input.verificationId },
      data: {
        status: VerificationStatus.VERIFIED,
        reviewedAt: new Date(),
        reviewedById: input.adminId,
        rejectionReason: null,
        internalNotes: input.internalNotes ?? null,
        expiresAt: input.expiresAt ?? null,
      },
    });
    await logVerificationAction({
      tx,
      userId: updated.userId,
      verificationId: updated.id,
      actorId: input.adminId,
      action: "VERIFICATION_APPROVED",
      metadata: { expiresAt: input.expiresAt?.toISOString() ?? null },
    });
    return updated;
  });
}

export async function rejectVerification(input: {
  verificationId: string;
  adminId: string;
  rejectionReason: string;
  internalNotes?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.userVerification.update({
      where: { id: input.verificationId },
      data: {
        status: VerificationStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedById: input.adminId,
        rejectionReason: input.rejectionReason,
        internalNotes: input.internalNotes ?? null,
      },
    });
    await logVerificationAction({
      tx,
      userId: updated.userId,
      verificationId: updated.id,
      actorId: input.adminId,
      action: "VERIFICATION_REJECTED",
      metadata: { rejectionReason: input.rejectionReason },
    });
    return updated;
  });
}

export async function canAdminViewVerification(adminId: string): Promise<boolean> {
  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: { role: true },
  });
  return Boolean(admin?.role && isAdminRole(admin.role));
}
