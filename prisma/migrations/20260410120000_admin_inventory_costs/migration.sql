-- Admin-only cost fields and part stock override flag
ALTER TABLE "Car" ADD COLUMN "supplierCostRmb" DECIMAL(14,2);
ALTER TABLE "Part" ADD COLUMN "supplierCostRmb" DECIMAL(14,2);
ALTER TABLE "Part" ADD COLUMN "stockStatusLocked" BOOLEAN NOT NULL DEFAULT false;
