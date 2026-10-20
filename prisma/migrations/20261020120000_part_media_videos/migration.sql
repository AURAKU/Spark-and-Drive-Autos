-- Additive parts media: cover flag on gallery images + part videos. No inventory data rewritten.
ALTER TABLE "PartImage" ADD COLUMN IF NOT EXISTS "isCover" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "PartVideo" (
  "id" TEXT NOT NULL,
  "partId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "publicId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "thumbnailUrl" TEXT,
  "mimeType" VARCHAR(120),
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartVideo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PartVideo_partId_sortOrder_idx" ON "PartVideo"("partId", "sortOrder");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PartVideo_partId_fkey'
  ) THEN
    ALTER TABLE "PartVideo"
      ADD CONSTRAINT "PartVideo_partId_fkey"
      FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Mark existing cover URL matches when possible.
UPDATE "PartImage" AS pi
SET "isCover" = true
FROM "Part" p
WHERE pi."partId" = p."id"
  AND p."coverImageUrl" IS NOT NULL
  AND pi."url" = p."coverImageUrl"
  AND pi."isCover" = false;
