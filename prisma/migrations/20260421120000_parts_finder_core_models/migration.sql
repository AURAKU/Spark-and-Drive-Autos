-- Parts Finder core persistence models
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PartsFinderMembershipStatus') THEN
    CREATE TYPE "PartsFinderMembershipStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PartsFinderSearchStatus') THEN
    CREATE TYPE "PartsFinderSearchStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'LOW_CONFIDENCE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PartsFinderConfidenceLabel') THEN
    CREATE TYPE "PartsFinderConfidenceLabel" AS ENUM ('VERIFIED_MATCH', 'LIKELY_MATCH', 'NEEDS_VERIFICATION');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "PartsFinderSettings" (
  "id" TEXT PRIMARY KEY,
  "currencyCode" TEXT NOT NULL DEFAULT 'GHS',
  "activationPriceMinor" INTEGER NOT NULL DEFAULT 50000,
  "activationDurationDays" INTEGER NOT NULL DEFAULT 30,
  "renewalPriceMinor" INTEGER NOT NULL DEFAULT 50000,
  "renewalDurationDays" INTEGER NOT NULL DEFAULT 30,
  "requireManualReviewBelow" INTEGER NOT NULL DEFAULT 55,
  "suspiciousPhraseThreshold" INTEGER NOT NULL DEFAULT 2,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PartsFinderMembership" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "status" "PartsFinderMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "suspendedAt" TIMESTAMP(3),
  "suspendedBy" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PartsFinderSearchSession" (
  "id" TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "membershipId" TEXT,
  "inputJson" JSONB NOT NULL,
  "normalizedJson" JSONB NOT NULL,
  "vehicleJson" JSONB,
  "queryFormsJson" JSONB,
  "rawResultsJson" JSONB,
  "rankedResultsJson" JSONB,
  "confidenceJson" JSONB,
  "summaryJson" JSONB,
  "safetyFlagsJson" JSONB,
  "status" "PartsFinderSearchStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "confidenceLabel" "PartsFinderConfidenceLabel",
  "confidenceScore" INTEGER,
  "adminSummaryOverride" TEXT,
  "reviewNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PartsFinderSearchSessionReview" (
  "id" TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "status" "PartsFinderSearchStatus" NOT NULL,
  "confidence" "PartsFinderConfidenceLabel",
  "note" TEXT,
  "summaryOverride" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PartsFinderConversion" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "conversionType" TEXT NOT NULL,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "PartsFinderSearchSession_sessionId_key" ON "PartsFinderSearchSession" ("sessionId");
CREATE INDEX IF NOT EXISTS "PartsFinderMembership_userId_status_idx" ON "PartsFinderMembership" ("userId", "status");
CREATE INDEX IF NOT EXISTS "PartsFinderMembership_endsAt_idx" ON "PartsFinderMembership" ("endsAt");
CREATE INDEX IF NOT EXISTS "PartsFinderSearchSession_userId_createdAt_idx" ON "PartsFinderSearchSession" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "PartsFinderSearchSession_status_createdAt_idx" ON "PartsFinderSearchSession" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "PartsFinderSearchSession_reviewedById_idx" ON "PartsFinderSearchSession" ("reviewedById");
CREATE INDEX IF NOT EXISTS "PartsFinderSearchSessionReview_sessionId_createdAt_idx" ON "PartsFinderSearchSessionReview" ("sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "PartsFinderSearchSessionReview_reviewerId_createdAt_idx" ON "PartsFinderSearchSessionReview" ("reviewerId", "createdAt");
CREATE INDEX IF NOT EXISTS "PartsFinderConversion_userId_conversionType_createdAt_idx" ON "PartsFinderConversion" ("userId", "conversionType", "createdAt");
CREATE INDEX IF NOT EXISTS "PartsFinderConversion_sessionId_createdAt_idx" ON "PartsFinderConversion" ("sessionId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PartsFinderMembership_userId_fkey'
  ) THEN
    ALTER TABLE "PartsFinderMembership"
      ADD CONSTRAINT "PartsFinderMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PartsFinderSearchSession_userId_fkey'
  ) THEN
    ALTER TABLE "PartsFinderSearchSession"
      ADD CONSTRAINT "PartsFinderSearchSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PartsFinderSearchSession_membershipId_fkey'
  ) THEN
    ALTER TABLE "PartsFinderSearchSession"
      ADD CONSTRAINT "PartsFinderSearchSession_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "PartsFinderMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PartsFinderSearchSession_reviewedById_fkey'
  ) THEN
    ALTER TABLE "PartsFinderSearchSession"
      ADD CONSTRAINT "PartsFinderSearchSession_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PartsFinderSearchSessionReview_sessionId_fkey'
  ) THEN
    ALTER TABLE "PartsFinderSearchSessionReview"
      ADD CONSTRAINT "PartsFinderSearchSessionReview_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PartsFinderSearchSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PartsFinderSearchSessionReview_reviewerId_fkey'
  ) THEN
    ALTER TABLE "PartsFinderSearchSessionReview"
      ADD CONSTRAINT "PartsFinderSearchSessionReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PartsFinderConversion_userId_fkey'
  ) THEN
    ALTER TABLE "PartsFinderConversion"
      ADD CONSTRAINT "PartsFinderConversion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PartsFinderConversion_sessionId_fkey'
  ) THEN
    ALTER TABLE "PartsFinderConversion"
      ADD CONSTRAINT "PartsFinderConversion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PartsFinderSearchSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
