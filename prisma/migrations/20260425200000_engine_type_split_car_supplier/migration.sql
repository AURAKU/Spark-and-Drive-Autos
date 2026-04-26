-- EngineType: split GASOLINE into GASOLINE_PETROL and GASOLINE_DIESEL; add car supplier-dealer (admin) fields.
-- PostgreSQL: add new enum values, migrate rows, then replace enum (Prisma expects GASOLINE removed).

ALTER TYPE "EngineType" ADD VALUE 'GASOLINE_PETROL';
ALTER TYPE "EngineType" ADD VALUE 'GASOLINE_DIESEL';

UPDATE "Car" SET "engineType" = 'GASOLINE_PETROL'::"EngineType" WHERE "engineType" = 'GASOLINE'::"EngineType";
UPDATE "CarRequest" SET "engineType" = 'GASOLINE_PETROL'::"EngineType" WHERE "engineType" = 'GASOLINE'::"EngineType";
UPDATE "VehicleImportEstimate" SET "engineType" = 'GASOLINE_PETROL'::"EngineType" WHERE "engineType" = 'GASOLINE'::"EngineType";

-- Recreate EngineType without legacy GASOLINE (Postgres cannot drop enum values in place).
CREATE TYPE "EngineType_new" AS ENUM (
  'GASOLINE_PETROL',
  'GASOLINE_DIESEL',
  'ELECTRIC',
  'HYBRID',
  'PLUGIN_HYBRID'
);

ALTER TABLE "Car" ALTER COLUMN "engineType" TYPE "EngineType_new" USING ("engineType"::text::"EngineType_new");
ALTER TABLE "CarRequest" ALTER COLUMN "engineType" TYPE "EngineType_new" USING ("engineType"::text::"EngineType_new");
ALTER TABLE "VehicleImportEstimate" ALTER COLUMN "engineType" TYPE "EngineType_new" USING ("engineType"::text::"EngineType_new");

DROP TYPE "EngineType";
ALTER TYPE "EngineType_new" RENAME TO "EngineType";

ALTER TABLE "Car" ADD COLUMN IF NOT EXISTS "supplierDealerName" VARCHAR(200);
ALTER TABLE "Car" ADD COLUMN IF NOT EXISTS "supplierDealerPhone" VARCHAR(40);
ALTER TABLE "Car" ADD COLUMN IF NOT EXISTS "supplierDealerReference" TEXT;
ALTER TABLE "Car" ADD COLUMN IF NOT EXISTS "supplierDealerNotes" TEXT;
