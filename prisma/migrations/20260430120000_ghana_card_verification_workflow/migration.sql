-- Ghana Card admin review workflow + AI-assisted pending fields

CREATE TYPE "GhanaCardVerificationStatus" AS ENUM ('NONE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

ALTER TABLE "User" ADD COLUMN "ghanaCardVerificationStatus" "GhanaCardVerificationStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "User" ADD COLUMN "ghanaCardPendingIdNumber" TEXT;
ALTER TABLE "User" ADD COLUMN "ghanaCardAiSuggestedNumber" TEXT;
ALTER TABLE "User" ADD COLUMN "ghanaCardRejectedReason" VARCHAR(500);
ALTER TABLE "User" ADD COLUMN "ghanaCardReviewedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "ghanaCardReviewedById" TEXT;

ALTER TABLE "User" ADD CONSTRAINT "User_ghanaCardReviewedById_fkey" FOREIGN KEY ("ghanaCardReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing linked IDs were saved before the workflow; treat as already approved.
UPDATE "User" SET "ghanaCardVerificationStatus" = 'APPROVED' WHERE "ghanaCardIdNumber" IS NOT NULL;
