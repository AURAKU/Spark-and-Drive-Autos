-- Part: admin supplier traceability (never exposed on public storefront)
ALTER TABLE "Part" ADD COLUMN "supplierDistributorRef" TEXT;
ALTER TABLE "Part" ADD COLUMN "supplierDistributorPhone" TEXT;

-- Cart line variants (same part, different color/size/type)
ALTER TABLE "PartCartItem" ADD COLUMN "optColor" TEXT;
ALTER TABLE "PartCartItem" ADD COLUMN "optSize" TEXT;
ALTER TABLE "PartCartItem" ADD COLUMN "optType" TEXT;
ALTER TABLE "PartCartItem" ADD COLUMN "variantKey" TEXT NOT NULL DEFAULT 'default';

-- Replace unique (cartId, partId) with (cartId, partId, variantKey)
ALTER TABLE "PartCartItem" DROP CONSTRAINT IF EXISTS "PartCartItem_cartId_partId_key";
CREATE UNIQUE INDEX "PartCartItem_cartId_partId_variantKey_key" ON "PartCartItem" ("cartId", "partId", "variantKey");

-- Order line snapshot
ALTER TABLE "PartOrderItem" ADD COLUMN "optionsJson" JSONB;
