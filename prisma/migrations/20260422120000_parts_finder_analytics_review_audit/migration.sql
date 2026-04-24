-- AlterTable
ALTER TABLE "PartsFinderSearchSession"
ADD COLUMN "analyticsVehicleLabel" TEXT,
ADD COLUMN "analyticsMakeModelLabel" TEXT,
ADD COLUMN "analyticsPartIntentLabel" TEXT,
ADD COLUMN "hasRankedResults" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PartsFinderSearchSessionReview"
ADD COLUMN "correctedPartName" TEXT,
ADD COLUMN "correctedOemCodes" JSONB,
ADD COLUMN "candidateBefore" JSONB,
ADD COLUMN "candidateAfter" JSONB;
