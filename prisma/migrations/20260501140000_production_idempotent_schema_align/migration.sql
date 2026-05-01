-- Idempotent additive changes for VPS / stale databases. Safe to re-run; no data drops.
-- Aligns common drift: migrations applied out of order or partial restores.

-- Car (inventory / checkout / admin forms)
ALTER TABLE "Car" ADD COLUMN IF NOT EXISTS "supplierCostRmb" DECIMAL(14,2);
ALTER TABLE "Car" ADD COLUMN IF NOT EXISTS "seaShippingFeeGhs" DECIMAL(14,2);
ALTER TABLE "Car" ADD COLUMN IF NOT EXISTS "reservationDepositPercent" DECIMAL(5,2);
ALTER TABLE "Car" ADD COLUMN IF NOT EXISTS "supplierDealerName" VARCHAR(200);
ALTER TABLE "Car" ADD COLUMN IF NOT EXISTS "supplierDealerPhone" VARCHAR(40);
ALTER TABLE "Car" ADD COLUMN IF NOT EXISTS "supplierDealerReference" TEXT;
ALTER TABLE "Car" ADD COLUMN IF NOT EXISTS "supplierDealerNotes" TEXT;

-- User Ghana Card workflow (older migrations used plain ADD without IF NOT EXISTS)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ghanaCardVerificationStatus" "GhanaCardVerificationStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ghanaCardPendingIdNumber" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ghanaCardAiSuggestedNumber" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ghanaCardRejectedReason" VARCHAR(500);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ghanaCardReviewedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ghanaCardReviewedById" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ghanaCardExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ghanaCardPendingImageUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ghanaCardPendingImagePublicId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ghanaCardPendingExpiresAt" TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accountBlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "messagingBlocked" BOOLEAN NOT NULL DEFAULT false;
