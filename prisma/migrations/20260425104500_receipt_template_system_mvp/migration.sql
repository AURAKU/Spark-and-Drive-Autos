-- CreateEnum
CREATE TYPE "ReceiptType" AS ENUM (
  'CAR_PAYMENT',
  'PARTS_PAYMENT',
  'PARTS_FINDER_ACTIVATION',
  'SOURCING_DEPOSIT',
  'WALLET_TOPUP',
  'MANUAL_PAYMENT'
);

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('ISSUED', 'VOIDED', 'REGENERATED', 'FAILED');

-- CreateTable
CREATE TABLE "ReceiptTemplate" (
  "id" TEXT NOT NULL,
  "type" "ReceiptType" NOT NULL,
  "version" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "businessName" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "categoryLabel" TEXT NOT NULL,
  "accentColor" TEXT NOT NULL DEFAULT '#31b6c7',
  "phone" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "signatureLabel" TEXT NOT NULL,
  "showSignatureLine" BOOLEAN NOT NULL DEFAULT true,
  "legalNote" TEXT NOT NULL,
  "footerNote" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReceiptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedReceipt" (
  "id" TEXT NOT NULL,
  "receiptNumber" TEXT NOT NULL,
  "type" "ReceiptType" NOT NULL,
  "paymentId" TEXT NOT NULL,
  "orderId" TEXT,
  "userId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "paymentReference" TEXT,
  "templateId" TEXT,
  "templateSnapshot" JSONB NOT NULL,
  "pdfUrl" TEXT NOT NULL,
  "status" "ReceiptStatus" NOT NULL DEFAULT 'ISSUED',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "generatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GeneratedReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptAuditLog" (
  "id" TEXT NOT NULL,
  "receiptId" TEXT,
  "templateId" TEXT,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReceiptAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptTemplate_type_version_key" ON "ReceiptTemplate"("type", "version");
CREATE INDEX "ReceiptTemplate_type_isActive_createdAt_idx" ON "ReceiptTemplate"("type", "isActive", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedReceipt_receiptNumber_key" ON "GeneratedReceipt"("receiptNumber");
CREATE INDEX "GeneratedReceipt_paymentId_issuedAt_idx" ON "GeneratedReceipt"("paymentId", "issuedAt");
CREATE INDEX "GeneratedReceipt_orderId_issuedAt_idx" ON "GeneratedReceipt"("orderId", "issuedAt");
CREATE INDEX "GeneratedReceipt_userId_issuedAt_idx" ON "GeneratedReceipt"("userId", "issuedAt");
CREATE INDEX "GeneratedReceipt_type_status_issuedAt_idx" ON "GeneratedReceipt"("type", "status", "issuedAt");
CREATE INDEX "GeneratedReceipt_paymentReference_idx" ON "GeneratedReceipt"("paymentReference");

-- CreateIndex
CREATE INDEX "ReceiptAuditLog_receiptId_createdAt_idx" ON "ReceiptAuditLog"("receiptId", "createdAt");
CREATE INDEX "ReceiptAuditLog_templateId_createdAt_idx" ON "ReceiptAuditLog"("templateId", "createdAt");
CREATE INDEX "ReceiptAuditLog_action_createdAt_idx" ON "ReceiptAuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "ReceiptTemplate"
  ADD CONSTRAINT "ReceiptTemplate_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GeneratedReceipt"
  ADD CONSTRAINT "GeneratedReceipt_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GeneratedReceipt"
  ADD CONSTRAINT "GeneratedReceipt_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GeneratedReceipt"
  ADD CONSTRAINT "GeneratedReceipt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GeneratedReceipt"
  ADD CONSTRAINT "GeneratedReceipt_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ReceiptTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GeneratedReceipt"
  ADD CONSTRAINT "GeneratedReceipt_generatedById_fkey"
  FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReceiptAuditLog"
  ADD CONSTRAINT "ReceiptAuditLog_receiptId_fkey"
  FOREIGN KEY ("receiptId") REFERENCES "GeneratedReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReceiptAuditLog"
  ADD CONSTRAINT "ReceiptAuditLog_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ReceiptTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReceiptAuditLog"
  ADD CONSTRAINT "ReceiptAuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
