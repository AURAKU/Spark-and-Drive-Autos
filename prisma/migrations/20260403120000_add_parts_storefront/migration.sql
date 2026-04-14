-- Parts & accessories storefront (Phase D) — separate from vehicle inventory.

-- CreateEnum
CREATE TYPE "PartListingState" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "PartStockStatus" AS ENUM ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'ON_REQUEST');

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT,
    "priceGhs" DECIMAL(14,2) NOT NULL,
    "category" TEXT NOT NULL,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "stockStatus" "PartStockStatus" NOT NULL DEFAULT 'IN_STOCK',
    "listingState" "PartListingState" NOT NULL DEFAULT 'DRAFT',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "coverImageUrl" TEXT,
    "coverImagePublicId" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartImage" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Part_slug_key" ON "Part"("slug");

-- CreateIndex
CREATE INDEX "Part_category_idx" ON "Part"("category");

-- CreateIndex
CREATE INDEX "Part_listingState_idx" ON "Part"("listingState");

-- CreateIndex
CREATE INDEX "Part_featured_idx" ON "Part"("featured");

-- CreateIndex
CREATE INDEX "Part_createdAt_idx" ON "Part"("createdAt");

-- CreateIndex
CREATE INDEX "PartImage_partId_sortOrder_idx" ON "PartImage"("partId", "sortOrder");

-- AddForeignKey
ALTER TABLE "PartImage" ADD CONSTRAINT "PartImage_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;
