-- Enums
ALTER TYPE "PaymentType" ADD VALUE IF NOT EXISTS 'VERIFIED_PART_REQUEST';
ALTER TYPE "ReceiptType" ADD VALUE IF NOT EXISTS 'VERIFIED_PART_REQUEST';

CREATE TYPE "VerifiedPartRequestStatus" AS ENUM (
  'DRAFT',
  'AWAITING_PAYMENT',
  'PAID',
  'IN_REVIEW',
  'VERIFIED',
  'NEEDS_MORE_INFO',
  'FAILED',
  'CANCELLED',
  'REFUNDED'
);

-- Settings
CREATE TABLE "VerifiedPartRequestSettings" (
  "id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "feeAmount" DECIMAL(14,2) NOT NULL DEFAULT 50,
  "currency" TEXT NOT NULL DEFAULT 'GHS',
  "serviceDescription" TEXT,
  "legalNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerifiedPartRequestSettings_pkey" PRIMARY KEY ("id")
);

-- Requests
CREATE TABLE "VerifiedPartRequest" (
  "id" TEXT NOT NULL,
  "requestNumber" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userVehicleId" TEXT,
  "partsFinderSearchId" TEXT,
  "selectedMatchId" TEXT,
  "vin" TEXT,
  "vehicleYear" INTEGER,
  "vehicleMake" TEXT,
  "vehicleModel" TEXT,
  "vehicleEngine" TEXT,
  "partName" TEXT NOT NULL,
  "customerNotes" TEXT,
  "selectedMatchSnapshot" JSONB,
  "status" "VerifiedPartRequestStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
  "verificationFee" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'GHS',
  "paymentId" TEXT,
  "receiptId" TEXT,
  "adminNotes" TEXT,
  "verifiedPartNumber" TEXT,
  "verifiedOemNumber" TEXT,
  "verifiedBrand" TEXT,
  "verifiedSupplier" TEXT,
  "verifiedPrice" DECIMAL(14,2),
  "verifiedCurrency" TEXT,
  "verifiedAvailability" TEXT,
  "verifiedFitmentNotes" TEXT,
  "resultJson" JSONB,
  "assignedAdminId" TEXT,
  "paidAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerifiedPartRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VerifiedPartRequest_requestNumber_key" ON "VerifiedPartRequest"("requestNumber");
CREATE INDEX "VerifiedPartRequest_userId_idx" ON "VerifiedPartRequest"("userId");
CREATE INDEX "VerifiedPartRequest_status_idx" ON "VerifiedPartRequest"("status");
CREATE INDEX "VerifiedPartRequest_paymentId_idx" ON "VerifiedPartRequest"("paymentId");
CREATE INDEX "VerifiedPartRequest_requestNumber_idx" ON "VerifiedPartRequest"("requestNumber");
CREATE INDEX "VerifiedPartRequest_createdAt_idx" ON "VerifiedPartRequest"("createdAt");

ALTER TABLE "VerifiedPartRequest"
  ADD CONSTRAINT "VerifiedPartRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifiedPartRequest"
  ADD CONSTRAINT "VerifiedPartRequest_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VerifiedPartRequest"
  ADD CONSTRAINT "VerifiedPartRequest_userVehicleId_fkey" FOREIGN KEY ("userVehicleId") REFERENCES "UserVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VerifiedPartRequest"
  ADD CONSTRAINT "VerifiedPartRequest_partsFinderSearchId_fkey" FOREIGN KEY ("partsFinderSearchId") REFERENCES "PartsFinderSearchSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VerifiedPartRequest"
  ADD CONSTRAINT "VerifiedPartRequest_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VerifiedPartRequest"
  ADD CONSTRAINT "VerifiedPartRequest_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "GeneratedReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
