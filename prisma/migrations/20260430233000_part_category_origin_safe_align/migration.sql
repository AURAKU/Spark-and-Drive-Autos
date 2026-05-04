-- Idempotent additive alignment for Part catalog + PartCategory (fixes Prisma/runtime crashes when
-- older DBs never received these objects). Safe to re-run; no destructive statements.

DO $$
BEGIN
  CREATE TYPE "PartOrigin" AS ENUM ('GHANA', 'CHINA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PartCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PartCategory_name_key" ON "PartCategory"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "PartCategory_slug_key" ON "PartCategory"("slug");
CREATE INDEX IF NOT EXISTS "PartCategory_active_sortOrder_idx" ON "PartCategory"("active", "sortOrder");

ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "basePriceRmb" DECIMAL(14, 2) NOT NULL DEFAULT 0;
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "origin" "PartOrigin" NOT NULL DEFAULT 'GHANA';
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "metaJson" JSONB;
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "sku" VARCHAR(120);
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;

CREATE INDEX IF NOT EXISTS "Part_categoryId_idx" ON "Part"("categoryId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Part_categoryId_fkey') THEN
    ALTER TABLE "Part"
      ADD CONSTRAINT "Part_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "PartCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
