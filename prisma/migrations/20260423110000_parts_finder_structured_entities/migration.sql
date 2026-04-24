DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PartsFinderReferenceType') THEN
    CREATE TYPE "PartsFinderReferenceType" AS ENUM ('OEM', 'ALTERNATE');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PartsFinderVerificationStatus') THEN
    CREATE TYPE "PartsFinderVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "PartsFinderSearchImage" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'PART_IMAGE',
  "fileName" TEXT,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartsFinderSearchImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PartsFinderResultReference" (
  "id" TEXT NOT NULL,
  "resultId" TEXT NOT NULL,
  "referenceType" "PartsFinderReferenceType" NOT NULL,
  "referenceCode" TEXT NOT NULL,
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartsFinderResultReference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PartsFinderResultFitment" (
  "id" TEXT NOT NULL,
  "resultId" TEXT NOT NULL,
  "brand" TEXT,
  "model" TEXT,
  "yearFrom" INTEGER,
  "yearTo" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartsFinderResultFitment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PartsFinderSupportVerification" (
  "id" TEXT NOT NULL,
  "resultId" TEXT NOT NULL,
  "status" "PartsFinderVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewerId" TEXT,
  "note" TEXT,
  "verifiedPartName" TEXT,
  "verifiedOemCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartsFinderSupportVerification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PartsFinderSearchImage_sessionId_createdAt_idx"
  ON "PartsFinderSearchImage"("sessionId", "createdAt");

CREATE INDEX IF NOT EXISTS "PartsFinderResultReference_resultId_referenceType_idx"
  ON "PartsFinderResultReference"("resultId", "referenceType");

CREATE INDEX IF NOT EXISTS "PartsFinderResultReference_referenceCode_idx"
  ON "PartsFinderResultReference"("referenceCode");

CREATE INDEX IF NOT EXISTS "PartsFinderResultFitment_resultId_createdAt_idx"
  ON "PartsFinderResultFitment"("resultId", "createdAt");

CREATE INDEX IF NOT EXISTS "PartsFinderSupportVerification_resultId_status_idx"
  ON "PartsFinderSupportVerification"("resultId", "status");

CREATE INDEX IF NOT EXISTS "PartsFinderSupportVerification_reviewerId_idx"
  ON "PartsFinderSupportVerification"("reviewerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PartsFinderSearchImage_sessionId_fkey'
  ) THEN
    ALTER TABLE "PartsFinderSearchImage"
      ADD CONSTRAINT "PartsFinderSearchImage_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "PartsFinderSearchSession"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PartsFinderResultReference_resultId_fkey'
  ) THEN
    ALTER TABLE "PartsFinderResultReference"
      ADD CONSTRAINT "PartsFinderResultReference_resultId_fkey"
      FOREIGN KEY ("resultId") REFERENCES "PartsFinderResult"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PartsFinderResultFitment_resultId_fkey'
  ) THEN
    ALTER TABLE "PartsFinderResultFitment"
      ADD CONSTRAINT "PartsFinderResultFitment_resultId_fkey"
      FOREIGN KEY ("resultId") REFERENCES "PartsFinderResult"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PartsFinderSupportVerification_resultId_fkey'
  ) THEN
    ALTER TABLE "PartsFinderSupportVerification"
      ADD CONSTRAINT "PartsFinderSupportVerification_resultId_fkey"
      FOREIGN KEY ("resultId") REFERENCES "PartsFinderResult"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PartsFinderSupportVerification_reviewerId_fkey'
  ) THEN
    ALTER TABLE "PartsFinderSupportVerification"
      ADD CONSTRAINT "PartsFinderSupportVerification_reviewerId_fkey"
      FOREIGN KEY ("reviewerId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
