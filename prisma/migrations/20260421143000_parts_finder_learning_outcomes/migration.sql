DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PartsFinderOutcomeStatus') THEN
    CREATE TYPE "PartsFinderOutcomeStatus" AS ENUM ('VERIFIED', 'LIKELY', 'REJECTED');
  END IF;
END $$;

ALTER TYPE "PartsFinderSearchStatus" ADD VALUE IF NOT EXISTS 'VERIFIED';
ALTER TYPE "PartsFinderSearchStatus" ADD VALUE IF NOT EXISTS 'LIKELY';
ALTER TYPE "PartsFinderSearchStatus" ADD VALUE IF NOT EXISTS 'FLAGGED_SOURCING';

ALTER TABLE "PartsFinderSearchSession"
  ADD COLUMN IF NOT EXISTS "refinedResultsJson" JSONB;

CREATE TABLE IF NOT EXISTS "PartsFinderResult" (
  "id" TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "candidateJson" JSONB NOT NULL,
  "summaryJson" JSONB,
  "derivationJson" JSONB,
  "confidenceLabel" "PartsFinderConfidenceLabel",
  "confidenceScore" INTEGER,
  "isTopResult" BOOLEAN NOT NULL DEFAULT false,
  "reviewStatus" "PartsFinderSearchStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "sourcingLinked" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PartsFinderVerifiedOutcome" (
  "id" TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "resultId" TEXT,
  "vehicleSignature" TEXT NOT NULL,
  "partIntentSignature" TEXT NOT NULL,
  "candidateSignature" TEXT,
  "outcomeStatus" "PartsFinderOutcomeStatus" NOT NULL,
  "note" TEXT,
  "reviewerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PartsFinderResult_sessionId_createdAt_idx" ON "PartsFinderResult" ("sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "PartsFinderResult_userId_createdAt_idx" ON "PartsFinderResult" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "PartsFinderVerifiedOutcome_vehicleSignature_partIntentSignature_outcomeStatus_idx" ON "PartsFinderVerifiedOutcome" ("vehicleSignature", "partIntentSignature", "outcomeStatus");
CREATE INDEX IF NOT EXISTS "PartsFinderVerifiedOutcome_sessionId_createdAt_idx" ON "PartsFinderVerifiedOutcome" ("sessionId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PartsFinderResult_sessionId_fkey') THEN
    ALTER TABLE "PartsFinderResult"
      ADD CONSTRAINT "PartsFinderResult_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "PartsFinderSearchSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PartsFinderResult_userId_fkey') THEN
    ALTER TABLE "PartsFinderResult"
      ADD CONSTRAINT "PartsFinderResult_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PartsFinderVerifiedOutcome_sessionId_fkey') THEN
    ALTER TABLE "PartsFinderVerifiedOutcome"
      ADD CONSTRAINT "PartsFinderVerifiedOutcome_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "PartsFinderSearchSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PartsFinderVerifiedOutcome_resultId_fkey') THEN
    ALTER TABLE "PartsFinderVerifiedOutcome"
      ADD CONSTRAINT "PartsFinderVerifiedOutcome_resultId_fkey"
      FOREIGN KEY ("resultId") REFERENCES "PartsFinderResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PartsFinderVerifiedOutcome_reviewerId_fkey') THEN
    ALTER TABLE "PartsFinderVerifiedOutcome"
      ADD CONSTRAINT "PartsFinderVerifiedOutcome_reviewerId_fkey"
      FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
