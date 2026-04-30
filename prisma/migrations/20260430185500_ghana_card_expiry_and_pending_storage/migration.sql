ALTER TYPE "GhanaCardVerificationStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

ALTER TABLE "User" ADD COLUMN "ghanaCardExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "ghanaCardPendingImageUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "ghanaCardPendingImagePublicId" TEXT;
ALTER TABLE "User" ADD COLUMN "ghanaCardPendingExpiresAt" TIMESTAMP(3);

