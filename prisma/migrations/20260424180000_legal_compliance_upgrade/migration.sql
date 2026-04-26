-- CreateEnum
CREATE TYPE "RiskTagSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PaymentDisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED');

-- AlterEnum: PaymentStatus
ALTER TYPE "PaymentStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "PaymentStatus" ADD VALUE 'REVERSED';

-- AlterTable UserRiskTag
ALTER TABLE "UserRiskTag" ADD COLUMN     "severity" "RiskTagSeverity" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "resolvedAt" TIMESTAMP(3);

CREATE INDEX "UserRiskTag_severity_createdAt_idx" ON "UserRiskTag"("severity", "createdAt");

-- AlterTable Contract
ALTER TABLE "Contract" ADD COLUMN     "title" TEXT,
ADD COLUMN     "createdById" TEXT;

ALTER TABLE "Contract" ADD CONSTRAINT "Contract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET ON UPDATE CASCADE;

-- AlterTable AgreementLog
ALTER TABLE "AgreementLog" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "userAgent" TEXT,
ADD COLUMN     "acceptanceTextSnapshot" TEXT;

-- AlterTable ContractAcceptance
ALTER TABLE "ContractAcceptance" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "userAgent" TEXT,
ADD COLUMN     "acceptanceTextSnapshot" TEXT;

-- CreateTable PaymentDispute
CREATE TABLE "PaymentDispute" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "reason" TEXT,
    "evidenceNotes" TEXT,
    "status" "PaymentDisputeStatus" NOT NULL DEFAULT 'OPEN',
    "flaggedById" TEXT NOT NULL,
    "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolutionNotes" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable UserPolicyAcceptance
CREATE TABLE "UserPolicyAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "context" TEXT NOT NULL,
    "acceptanceTextSnapshot" TEXT NOT NULL,

    CONSTRAINT "UserPolicyAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable LegalAuditLog
CREATE TABLE "LegalAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "targetUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentDispute_paymentId_flaggedAt_idx" ON "PaymentDispute"("paymentId", "flaggedAt");

-- CreateIndex
CREATE INDEX "PaymentDispute_status_flaggedAt_idx" ON "PaymentDispute"("status", "flaggedAt");

-- CreateIndex
CREATE INDEX "UserPolicyAcceptance_userId_context_acceptedAt_idx" ON "UserPolicyAcceptance"("userId", "context", "acceptedAt");

-- CreateIndex
CREATE INDEX "UserPolicyAcceptance_policyVersionId_idx" ON "UserPolicyAcceptance"("policyVersionId");

-- CreateIndex
CREATE INDEX "LegalAuditLog_createdAt_idx" ON "LegalAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "LegalAuditLog_action_createdAt_idx" ON "LegalAuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "LegalAuditLog_entityType_entityId_idx" ON "LegalAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "LegalAuditLog_targetUserId_createdAt_idx" ON "LegalAuditLog"("targetUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "PaymentDispute" ADD CONSTRAINT "PaymentDispute_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentDispute" ADD CONSTRAINT "PaymentDispute_flaggedById_fkey" FOREIGN KEY ("flaggedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentDispute" ADD CONSTRAINT "PaymentDispute_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPolicyAcceptance" ADD CONSTRAINT "UserPolicyAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPolicyAcceptance" ADD CONSTRAINT "UserPolicyAcceptance_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalAuditLog" ADD CONSTRAINT "LegalAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalAuditLog" ADD CONSTRAINT "LegalAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
