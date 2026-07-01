-- Duty Intelligence Engine V3: shipping cost matrix, insurance rules, admin overrides

CREATE TYPE "DutyExportCountry" AS ENUM (
  'CHINA',
  'JAPAN',
  'USA',
  'UK',
  'GERMANY',
  'KOREA',
  'DUBAI',
  'SINGAPORE',
  'THAILAND',
  'MALAYSIA',
  'OTHER'
);

CREATE TABLE "DutyShippingCostMatrix" (
  "id" TEXT NOT NULL,
  "countryConfigId" TEXT NOT NULL,
  "originCountry" "DutyExportCountry" NOT NULL,
  "vehicleCategory" "DutyVehicleCategory",
  "shippingMethod" "DutyShippingMethod" NOT NULL,
  "containerType" VARCHAR(40),
  "freightGhs" DECIMAL(14,2) NOT NULL,
  "transitDays" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DutyShippingCostMatrix_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DutyInsuranceRule" (
  "id" TEXT NOT NULL,
  "countryConfigId" TEXT NOT NULL,
  "originCountry" "DutyExportCountry",
  "shippingMethod" "DutyShippingMethod",
  "percentageRate" DECIMAL(8,6) NOT NULL,
  "minimumGhs" DECIMAL(14,2),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DutyInsuranceRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DutyOverride" (
  "id" TEXT NOT NULL,
  "countryConfigId" TEXT NOT NULL,
  "calculationId" TEXT,
  "actorId" TEXT,
  "overrideType" VARCHAR(32) NOT NULL,
  "fieldKey" VARCHAR(64) NOT NULL,
  "originalValue" DECIMAL(18,8),
  "overrideValue" DECIMAL(18,8) NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DutyOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DutyShippingCostMatrix_countryConfigId_originCountry_vehicleCategory_shippingMethod_containerType_key"
  ON "DutyShippingCostMatrix"("countryConfigId", "originCountry", "vehicleCategory", "shippingMethod", "containerType");

CREATE INDEX "DutyShippingCostMatrix_countryConfigId_originCountry_active_idx"
  ON "DutyShippingCostMatrix"("countryConfigId", "originCountry", "active");

CREATE INDEX "DutyShippingCostMatrix_countryConfigId_shippingMethod_active_idx"
  ON "DutyShippingCostMatrix"("countryConfigId", "shippingMethod", "active");

CREATE INDEX "DutyInsuranceRule_countryConfigId_active_idx"
  ON "DutyInsuranceRule"("countryConfigId", "active");

CREATE INDEX "DutyOverride_countryConfigId_createdAt_idx"
  ON "DutyOverride"("countryConfigId", "createdAt");

CREATE INDEX "DutyOverride_calculationId_idx"
  ON "DutyOverride"("calculationId");

CREATE INDEX "DutyOverride_actorId_idx"
  ON "DutyOverride"("actorId");

ALTER TABLE "DutyShippingCostMatrix"
  ADD CONSTRAINT "DutyShippingCostMatrix_countryConfigId_fkey"
  FOREIGN KEY ("countryConfigId") REFERENCES "DutyCountryConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DutyInsuranceRule"
  ADD CONSTRAINT "DutyInsuranceRule_countryConfigId_fkey"
  FOREIGN KEY ("countryConfigId") REFERENCES "DutyCountryConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DutyOverride"
  ADD CONSTRAINT "DutyOverride_countryConfigId_fkey"
  FOREIGN KEY ("countryConfigId") REFERENCES "DutyCountryConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DutyOverride"
  ADD CONSTRAINT "DutyOverride_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
