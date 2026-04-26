-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('NOT_REQUIRED', 'REQUIRED', 'PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "VerificationDocumentType" AS ENUM ('GHANA_CARD', 'PASSPORT', 'DRIVER_LICENSE', 'BUSINESS_REGISTRATION', 'OTHER');

-- CreateTable
CREATE TABLE "UserVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentType" "VerificationDocumentType" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "documentFrontUrl" TEXT NOT NULL,
    "documentBackUrl" TEXT,
    "selfieUrl" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "rejectionReason" TEXT,
    "internalNotes" TEXT,
    "expiresAt" TIMESTAMP(3),
    "consentAccepted" BOOLEAN NOT NULL DEFAULT false,
    "consentText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verificationId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserVerification_userId_createdAt_idx" ON "UserVerification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserVerification_status_createdAt_idx" ON "UserVerification"("status", "createdAt");

-- CreateIndex
CREATE INDEX "UserVerification_documentType_createdAt_idx" ON "UserVerification"("documentType", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationAuditLog_userId_createdAt_idx" ON "VerificationAuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationAuditLog_verificationId_createdAt_idx" ON "VerificationAuditLog"("verificationId", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationAuditLog_action_createdAt_idx" ON "VerificationAuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "UserVerification" ADD CONSTRAINT "UserVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVerification" ADD CONSTRAINT "UserVerification_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationAuditLog" ADD CONSTRAINT "VerificationAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationAuditLog" ADD CONSTRAINT "VerificationAuditLog_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "UserVerification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationAuditLog" ADD CONSTRAINT "VerificationAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
