-- Duty Intelligence Engine

CREATE TYPE "DutyCountryCode" AS ENUM ('GH');
CREATE TYPE "DutyVehicleCategory" AS ENUM ('SUV', 'SEDAN', 'PICKUP', 'TRUCK', 'BUS', 'VAN');
CREATE TYPE "DutyShippingMethod" AS ENUM ('CONTAINER', 'RORO', 'AIR_FREIGHT', 'SEA_FREIGHT');
CREATE TYPE "DutyExchangeRateSource" AS ENUM ('BANK_OF_GHANA', 'CUSTOMS', 'MANUAL_OVERRIDE', 'GLOBAL_CURRENCY');
CREATE TYPE "DutyFormulaBasis" AS ENUM ('CIF', 'CUSTOMS_VALUE', 'IMPORT_DUTY', 'LEVY_SUBTOTAL', 'VAT_BASE', 'FOB', 'FIXED');
CREATE TYPE "DutyFormulaRateType" AS ENUM ('PERCENTAGE', 'FIXED', 'BLENDED');
CREATE TYPE "DutyChargeCategory" AS ENUM ('PORT', 'SHIPPING_LINE', 'AGENT');
CREATE TYPE "DutyVerifiedImportStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'DISPUTED', 'ARCHIVED');
CREATE TYPE "DutyDocumentType" AS ENUM ('BILL_OF_ENTRY', 'BILL_OF_LADING', 'COMMERCIAL_INVOICE', 'PACKING_LIST', 'DUTY_RECEIPT', 'INSPECTION_REPORT', 'CONTAINER_DETAILS', 'VEHICLE_PHOTO', 'VIN_PHOTO', 'RECEIPT', 'OTHER');
CREATE TYPE "DutyCalculationStatus" AS ENUM ('DRAFT', 'SAVED', 'ARCHIVED');

CREATE TABLE "DutyCountryConfig" (
    "id" TEXT NOT NULL,
    "countryCode" "DutyCountryCode" NOT NULL,
    "name" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'GHS',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "configJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DutyCountryConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DutyFormulaRule" (
    "id" TEXT NOT NULL,
    "countryConfigId" TEXT NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "label" TEXT NOT NULL,
    "basis" "DutyFormulaBasis" NOT NULL,
    "rateType" "DutyFormulaRateType" NOT NULL,
    "rateValue" DECIMAL(18,8) NOT NULL,
    "conditionsJson" JSONB,
    "formulaNote" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DutyFormulaRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DutyFormulaRuleHistory" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "changeNote" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DutyFormulaRuleHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DutyHsCode" (
    "id" TEXT NOT NULL,
    "countryConfigId" TEXT NOT NULL,
    "hsCode" VARCHAR(16) NOT NULL,
    "description" TEXT NOT NULL,
    "vehicleCategory" "DutyVehicleCategory",
    "fuelType" "EngineType",
    "engineCcMin" INTEGER,
    "engineCcMax" INTEGER,
    "grossWeightMin" INTEGER,
    "grossWeightMax" INTEGER,
    "isCommercial" BOOLEAN,
    "dutyRateHint" DECIMAL(8,6),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DutyHsCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DutyExchangeRate" (
    "id" TEXT NOT NULL,
    "countryConfigId" TEXT NOT NULL,
    "source" "DutyExchangeRateSource" NOT NULL,
    "fromCurrency" VARCHAR(3) NOT NULL,
    "toCurrency" VARCHAR(3) NOT NULL DEFAULT 'GHS',
    "rate" DECIMAL(18,8) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DutyExchangeRate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DutyShippingLine" (
    "id" TEXT NOT NULL,
    "countryConfigId" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DutyShippingLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DutyChargeTemplate" (
    "id" TEXT NOT NULL,
    "countryConfigId" TEXT NOT NULL,
    "category" "DutyChargeCategory" NOT NULL,
    "subcategory" VARCHAR(64) NOT NULL,
    "label" TEXT NOT NULL,
    "amountGhs" DECIMAL(14,2),
    "amountUsd" DECIMAL(14,2),
    "calculationType" VARCHAR(24) NOT NULL DEFAULT 'FIXED',
    "rateValue" DECIMAL(18,8),
    "shippingLineId" TEXT,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DutyChargeTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DutyCalculation" (
    "id" TEXT NOT NULL,
    "countryConfigId" TEXT NOT NULL,
    "referenceNumber" VARCHAR(32) NOT NULL,
    "status" "DutyCalculationStatus" NOT NULL DEFAULT 'DRAFT',
    "carId" TEXT,
    "createdById" TEXT,
    "inputJson" JSONB NOT NULL,
    "resultJson" JSONB NOT NULL,
    "formulaVersion" VARCHAR(64) NOT NULL,
    "confidenceScore" DECIMAL(5,2),
    "confidenceLabel" VARCHAR(32),
    "similarImportCount" INTEGER NOT NULL DEFAULT 0,
    "totalLandedCostGhs" DECIMAL(14,2) NOT NULL,
    "totalGraTaxesGhs" DECIMAL(14,2) NOT NULL,
    "totalPortChargesGhs" DECIMAL(14,2) NOT NULL,
    "cifGhs" DECIMAL(14,2) NOT NULL,
    "customsValueGhs" DECIMAL(14,2) NOT NULL,
    "hsCode" VARCHAR(16),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DutyCalculation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DutyVerifiedImport" (
    "id" TEXT NOT NULL,
    "countryConfigId" TEXT NOT NULL,
    "status" "DutyVerifiedImportStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "createdById" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "trim" TEXT,
    "year" INTEGER,
    "vin" VARCHAR(32),
    "chassis" VARCHAR(64),
    "countryOfOrigin" TEXT,
    "vehicleCategory" "DutyVehicleCategory",
    "fuelType" "EngineType",
    "engineCc" INTEGER,
    "batteryKwh" DECIMAL(8,2),
    "horsepower" INTEGER,
    "grossWeightKg" INTEGER,
    "seatingCapacity" INTEGER,
    "hsCode" VARCHAR(16),
    "fobAmount" DECIMAL(14,2),
    "fobCurrency" VARCHAR(3),
    "freightGhs" DECIMAL(14,2),
    "insuranceGhs" DECIMAL(14,2),
    "exchangeRate" DECIMAL(18,8),
    "cifGhs" DECIMAL(14,2),
    "customsValueGhs" DECIMAL(14,2),
    "importDutyGhs" DECIMAL(14,2),
    "vatGhs" DECIMAL(14,2),
    "nhilGhs" DECIMAL(14,2),
    "getfundGhs" DECIMAL(14,2),
    "specialLevyGhs" DECIMAL(14,2),
    "eximLevyGhs" DECIMAL(14,2),
    "ecowasLevyGhs" DECIMAL(14,2),
    "auLevyGhs" DECIMAL(14,2),
    "inspectionFeeGhs" DECIMAL(14,2),
    "processingFeeGhs" DECIMAL(14,2),
    "networkChargesGhs" DECIMAL(14,2),
    "shippingLineGhs" DECIMAL(14,2),
    "portChargesGhs" DECIMAL(14,2),
    "agentFeesGhs" DECIMAL(14,2),
    "totalDutyGhs" DECIMAL(14,2),
    "totalLandedCostGhs" DECIMAL(14,2),
    "clearanceDays" INTEGER,
    "shippingLine" TEXT,
    "containerNumber" TEXT,
    "billOfEntryNumber" TEXT,
    "billOfLading" TEXT,
    "estimatedDutyGhs" DECIMAL(14,2),
    "predictionErrorPct" DECIMAL(8,4),
    "notes" TEXT,
    "breakdownJson" JSONB,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DutyVerifiedImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DutyVerifiedImportDocument" (
    "id" TEXT NOT NULL,
    "verifiedImportId" TEXT NOT NULL,
    "documentType" "DutyDocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "filePublicId" TEXT,
    "ocrExtractedJson" JSONB,
    "ocrStatus" VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    "ocrCorrectedJson" JSONB,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DutyVerifiedImportDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DutyCalibrationFactor" (
    "id" TEXT NOT NULL,
    "countryConfigId" TEXT NOT NULL,
    "category" VARCHAR(64) NOT NULL,
    "factor" DECIMAL(8,6) NOT NULL,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "avgErrorPct" DECIMAL(8,4),
    "lastCalibratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DutyCalibrationFactor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DutyIntelligenceAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DutyIntelligenceAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DutyCountryConfig_countryCode_key" ON "DutyCountryConfig"("countryCode");
CREATE UNIQUE INDEX "DutyFormulaRule_countryConfigId_code_version_key" ON "DutyFormulaRule"("countryConfigId", "code", "version");
CREATE INDEX "DutyFormulaRule_countryConfigId_active_sortOrder_idx" ON "DutyFormulaRule"("countryConfigId", "active", "sortOrder");
CREATE INDEX "DutyFormulaRule_code_idx" ON "DutyFormulaRule"("code");
CREATE INDEX "DutyFormulaRuleHistory_ruleId_version_idx" ON "DutyFormulaRuleHistory"("ruleId", "version");
CREATE INDEX "DutyFormulaRuleHistory_createdAt_idx" ON "DutyFormulaRuleHistory"("createdAt");
CREATE INDEX "DutyHsCode_countryConfigId_hsCode_idx" ON "DutyHsCode"("countryConfigId", "hsCode");
CREATE INDEX "DutyHsCode_countryConfigId_active_idx" ON "DutyHsCode"("countryConfigId", "active");
CREATE INDEX "DutyHsCode_fuelType_vehicleCategory_idx" ON "DutyHsCode"("fuelType", "vehicleCategory");
CREATE INDEX "DutyExchangeRate_countryConfigId_fromCurrency_toCurrency_effectiveDate_idx" ON "DutyExchangeRate"("countryConfigId", "fromCurrency", "toCurrency", "effectiveDate");
CREATE INDEX "DutyExchangeRate_source_effectiveDate_idx" ON "DutyExchangeRate"("source", "effectiveDate");
CREATE UNIQUE INDEX "DutyShippingLine_countryConfigId_code_key" ON "DutyShippingLine"("countryConfigId", "code");
CREATE INDEX "DutyShippingLine_countryConfigId_active_idx" ON "DutyShippingLine"("countryConfigId", "active");
CREATE INDEX "DutyChargeTemplate_countryConfigId_category_active_idx" ON "DutyChargeTemplate"("countryConfigId", "category", "active");
CREATE INDEX "DutyChargeTemplate_shippingLineId_idx" ON "DutyChargeTemplate"("shippingLineId");
CREATE UNIQUE INDEX "DutyCalculation_referenceNumber_key" ON "DutyCalculation"("referenceNumber");
CREATE INDEX "DutyCalculation_countryConfigId_createdAt_idx" ON "DutyCalculation"("countryConfigId", "createdAt");
CREATE INDEX "DutyCalculation_carId_idx" ON "DutyCalculation"("carId");
CREATE INDEX "DutyCalculation_status_createdAt_idx" ON "DutyCalculation"("status", "createdAt");
CREATE INDEX "DutyCalculation_hsCode_idx" ON "DutyCalculation"("hsCode");
CREATE INDEX "DutyVerifiedImport_countryConfigId_status_createdAt_idx" ON "DutyVerifiedImport"("countryConfigId", "status", "createdAt");
CREATE INDEX "DutyVerifiedImport_manufacturer_model_year_idx" ON "DutyVerifiedImport"("manufacturer", "model", "year");
CREATE INDEX "DutyVerifiedImport_vin_idx" ON "DutyVerifiedImport"("vin");
CREATE INDEX "DutyVerifiedImport_hsCode_idx" ON "DutyVerifiedImport"("hsCode");
CREATE INDEX "DutyVerifiedImport_fuelType_vehicleCategory_idx" ON "DutyVerifiedImport"("fuelType", "vehicleCategory");
CREATE INDEX "DutyVerifiedImportDocument_verifiedImportId_documentType_idx" ON "DutyVerifiedImportDocument"("verifiedImportId", "documentType");
CREATE INDEX "DutyVerifiedImportDocument_ocrStatus_idx" ON "DutyVerifiedImportDocument"("ocrStatus");
CREATE UNIQUE INDEX "DutyCalibrationFactor_countryConfigId_category_key" ON "DutyCalibrationFactor"("countryConfigId", "category");
CREATE INDEX "DutyCalibrationFactor_countryConfigId_idx" ON "DutyCalibrationFactor"("countryConfigId");
CREATE INDEX "DutyIntelligenceAuditLog_entityType_entityId_idx" ON "DutyIntelligenceAuditLog"("entityType", "entityId");
CREATE INDEX "DutyIntelligenceAuditLog_createdAt_idx" ON "DutyIntelligenceAuditLog"("createdAt");
CREATE INDEX "DutyIntelligenceAuditLog_actorId_idx" ON "DutyIntelligenceAuditLog"("actorId");

ALTER TABLE "DutyFormulaRule" ADD CONSTRAINT "DutyFormulaRule_countryConfigId_fkey" FOREIGN KEY ("countryConfigId") REFERENCES "DutyCountryConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DutyFormulaRule" ADD CONSTRAINT "DutyFormulaRule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DutyFormulaRuleHistory" ADD CONSTRAINT "DutyFormulaRuleHistory_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "DutyFormulaRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DutyFormulaRuleHistory" ADD CONSTRAINT "DutyFormulaRuleHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DutyHsCode" ADD CONSTRAINT "DutyHsCode_countryConfigId_fkey" FOREIGN KEY ("countryConfigId") REFERENCES "DutyCountryConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DutyExchangeRate" ADD CONSTRAINT "DutyExchangeRate_countryConfigId_fkey" FOREIGN KEY ("countryConfigId") REFERENCES "DutyCountryConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DutyExchangeRate" ADD CONSTRAINT "DutyExchangeRate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DutyShippingLine" ADD CONSTRAINT "DutyShippingLine_countryConfigId_fkey" FOREIGN KEY ("countryConfigId") REFERENCES "DutyCountryConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DutyChargeTemplate" ADD CONSTRAINT "DutyChargeTemplate_countryConfigId_fkey" FOREIGN KEY ("countryConfigId") REFERENCES "DutyCountryConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DutyChargeTemplate" ADD CONSTRAINT "DutyChargeTemplate_shippingLineId_fkey" FOREIGN KEY ("shippingLineId") REFERENCES "DutyShippingLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DutyCalculation" ADD CONSTRAINT "DutyCalculation_countryConfigId_fkey" FOREIGN KEY ("countryConfigId") REFERENCES "DutyCountryConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DutyCalculation" ADD CONSTRAINT "DutyCalculation_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DutyCalculation" ADD CONSTRAINT "DutyCalculation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DutyVerifiedImport" ADD CONSTRAINT "DutyVerifiedImport_countryConfigId_fkey" FOREIGN KEY ("countryConfigId") REFERENCES "DutyCountryConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DutyVerifiedImport" ADD CONSTRAINT "DutyVerifiedImport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DutyVerifiedImportDocument" ADD CONSTRAINT "DutyVerifiedImportDocument_verifiedImportId_fkey" FOREIGN KEY ("verifiedImportId") REFERENCES "DutyVerifiedImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DutyCalibrationFactor" ADD CONSTRAINT "DutyCalibrationFactor_countryConfigId_fkey" FOREIGN KEY ("countryConfigId") REFERENCES "DutyCountryConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DutyIntelligenceAuditLog" ADD CONSTRAINT "DutyIntelligenceAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
