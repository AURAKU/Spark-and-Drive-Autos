-- CreateEnum
CREATE TYPE "DisputeCaseType" AS ENUM (
  'PAYMENT_DISPUTE',
  'CHARGEBACK',
  'REFUND_REQUEST',
  'FAKE_PAYMENT_CLAIM',
  'MANUAL_PAYMENT_REVIEW',
  'SOURCING_DISPUTE',
  'PARTS_FITMENT_DISPUTE',
  'DELIVERY_LOGISTICS_DISPUTE',
  'WALLET_DISPUTE',
  'PARTS_FINDER_DISPUTE',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "DisputeCaseStatus" AS ENUM (
  'OPEN',
  'UNDER_REVIEW',
  'AWAITING_CUSTOMER_RESPONSE',
  'AWAITING_PROVIDER_RESPONSE',
  'EVIDENCE_COLLECTED',
  'ESCALATED',
  'RESOLVED_APPROVED',
  'RESOLVED_REJECTED',
  'REFUNDED',
  'CLOSED'
);

-- CreateEnum
CREATE TYPE "DisputePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DisputeEvidenceType" AS ENUM (
  'PAYMENT_VERIFICATION',
  'RECEIPT',
  'ORDER_RECORD',
  'POLICY_ACCEPTANCE',
  'CONTRACT_ACCEPTANCE',
  'IDENTITY_VERIFICATION',
  'CHAT_TRANSCRIPT',
  'DELIVERY_RECORD',
  'SOURCING_APPROVAL',
  'PARTS_FINDER_RESULT',
  'ADMIN_NOTE',
  'CUSTOMER_UPLOAD',
  'PROVIDER_RESPONSE',
  'OTHER'
);

-- CreateTable
CREATE TABLE "DisputeCase" (
  "id" TEXT NOT NULL,
  "caseNumber" TEXT NOT NULL,
  "type" "DisputeCaseType" NOT NULL,
  "status" "DisputeCaseStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "DisputePriority" NOT NULL DEFAULT 'MEDIUM',
  "userId" TEXT,
  "paymentId" TEXT,
  "orderId" TEXT,
  "receiptId" TEXT,
  "sourcingRequestId" TEXT,
  "partsFinderSessionId" TEXT,
  "amount" DECIMAL(14,2),
  "currency" TEXT,
  "reason" TEXT NOT NULL,
  "customerClaim" TEXT,
  "adminSummary" TEXT,
  "resolution" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "assignedToId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DisputeCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputeEvidence" (
  "id" TEXT NOT NULL,
  "disputeId" TEXT NOT NULL,
  "evidenceType" "DisputeEvidenceType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "fileUrl" TEXT,
  "metadata" JSONB,
  "addedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DisputeEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputeTimelineEvent" (
  "id" TEXT NOT NULL,
  "disputeId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "oldStatus" "DisputeCaseStatus",
  "newStatus" "DisputeCaseStatus",
  "note" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DisputeTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputeActionLog" (
  "id" TEXT NOT NULL,
  "disputeId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DisputeActionLog_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "DisputeCase_caseNumber_key" ON "DisputeCase"("caseNumber");
CREATE INDEX "DisputeCase_status_priority_openedAt_idx" ON "DisputeCase"("status", "priority", "openedAt");
CREATE INDEX "DisputeCase_type_status_openedAt_idx" ON "DisputeCase"("type", "status", "openedAt");
CREATE INDEX "DisputeCase_userId_openedAt_idx" ON "DisputeCase"("userId", "openedAt");
CREATE INDEX "DisputeCase_paymentId_openedAt_idx" ON "DisputeCase"("paymentId", "openedAt");
CREATE INDEX "DisputeCase_orderId_openedAt_idx" ON "DisputeCase"("orderId", "openedAt");

CREATE INDEX "DisputeEvidence_disputeId_createdAt_idx" ON "DisputeEvidence"("disputeId", "createdAt");
CREATE INDEX "DisputeEvidence_evidenceType_createdAt_idx" ON "DisputeEvidence"("evidenceType", "createdAt");
CREATE INDEX "DisputeTimelineEvent_disputeId_createdAt_idx" ON "DisputeTimelineEvent"("disputeId", "createdAt");
CREATE INDEX "DisputeActionLog_disputeId_createdAt_idx" ON "DisputeActionLog"("disputeId", "createdAt");
CREATE INDEX "DisputeActionLog_action_createdAt_idx" ON "DisputeActionLog"("action", "createdAt");

-- FKs
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "GeneratedReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_sourcingRequestId_fkey" FOREIGN KEY ("sourcingRequestId") REFERENCES "CarRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_partsFinderSessionId_fkey" FOREIGN KEY ("partsFinderSessionId") REFERENCES "PartsFinderSearchSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DisputeEvidence" ADD CONSTRAINT "DisputeEvidence_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "DisputeCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DisputeEvidence" ADD CONSTRAINT "DisputeEvidence_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DisputeTimelineEvent" ADD CONSTRAINT "DisputeTimelineEvent_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "DisputeCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DisputeTimelineEvent" ADD CONSTRAINT "DisputeTimelineEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DisputeActionLog" ADD CONSTRAINT "DisputeActionLog_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "DisputeCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DisputeActionLog" ADD CONSTRAINT "DisputeActionLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
