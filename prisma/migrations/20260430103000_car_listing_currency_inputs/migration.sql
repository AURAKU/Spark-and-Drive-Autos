-- AlterTable: admin listing + supplier amounts/currencies; backfill from legacy RMB columns
ALTER TABLE "Car" ADD COLUMN "basePriceAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Car" ADD COLUMN "basePriceCurrency" VARCHAR(3) NOT NULL DEFAULT 'CNY';
ALTER TABLE "Car" ADD COLUMN "supplierCostAmount" DECIMAL(14,2);
ALTER TABLE "Car" ADD COLUMN "supplierCostCurrency" VARCHAR(3);

UPDATE "Car"
SET
  "basePriceAmount" = "basePriceRmb",
  "basePriceCurrency" = 'CNY';

UPDATE "Car"
SET
  "supplierCostAmount" = "supplierCostRmb",
  "supplierCostCurrency" = 'CNY'
WHERE "supplierCostRmb" IS NOT NULL;
