-- Part admin: list/supplier currency + structured metadata + internal notes (additive, non-destructive).

ALTER TABLE "Part" ADD COLUMN "supplierCostCurrency" VARCHAR(3) NOT NULL DEFAULT 'GHS';
ALTER TABLE "Part" ADD COLUMN "sellingPriceCurrency" VARCHAR(3) NOT NULL DEFAULT 'GHS';
ALTER TABLE "Part" ADD COLUMN "partNumber" VARCHAR(120);
ALTER TABLE "Part" ADD COLUMN "oemNumber" VARCHAR(120);
ALTER TABLE "Part" ADD COLUMN "compatibleMake" VARCHAR(80);
ALTER TABLE "Part" ADD COLUMN "compatibleModel" VARCHAR(80);
ALTER TABLE "Part" ADD COLUMN "compatibleYearNote" VARCHAR(80);
ALTER TABLE "Part" ADD COLUMN "condition" VARCHAR(120);
ALTER TABLE "Part" ADD COLUMN "warehouseLocation" VARCHAR(200);
ALTER TABLE "Part" ADD COLUMN "internalNotes" TEXT;

-- Align currencies with existing pricing semantics (canonical RMB still source of truth).
UPDATE "Part" SET "sellingPriceCurrency" = 'CNY' WHERE "origin" = 'CHINA' AND "sellingPriceCurrency" = 'GHS';
UPDATE "Part" SET "supplierCostCurrency" = 'CNY' WHERE "supplierCostRmb" IS NOT NULL AND "supplierCostCurrency" = 'GHS';
