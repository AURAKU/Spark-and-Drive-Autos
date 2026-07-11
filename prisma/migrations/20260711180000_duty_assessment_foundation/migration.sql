-- Duty Assessment Foundation (Prompt 2)
-- Adds verified BoE/receipt storage, vehicle profiles, rule evidence, and extends DutyCalculation.
-- Safe: additive only; no data loss; backfills nullable fields from existing rows.

-- CreateEnum
CREATE TYPE "DutyFuelType" AS ENUM ('GASOLINE', 'DIESEL', 'ELECTRIC', 'HYBRID', 'PLUGIN_HYBRID');
CREATE TYPE "DutyEvidenceKind" AS ENUM (
  'BILL_OF_ENTRY',
  'PAYMENT_RECEIPT',
  'BILL_OF_LADING',
  'COMMERCIAL_INVOICE',
  'PACKING_LIST',
  'INSPECTION_REPORT',
  'CONTAINER_DETAILS',
  'VEHICLE_PHOTO',
  'VIN_PHOTO',
  'OTHER'
);
CREATE TYPE "DutyAssessmentSourceKind" AS ENUM (
  'BILL_OF_ENTRY',
  'PAYMENT_RECEIPT',
  'COMBINED_ASSESSMENT',
  'ADMIN_IMPORT',
  'LEGACY_VERIFIED_IMPORT',
  'CALIBRATION_FIXTURE'
);
CREATE TYPE "DutyAssessmentStatus" AS ENUM (
  'DRAFT',
  'ASSESSED',
  'PARTIALLY_PAID',
  'PAID',
  'VERIFIED',
  'DISPUTED',
  'ARCHIVED'
);
CREATE TYPE "DutyVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'DISPUTED', 'REJECTED', 'ARCHIVED');
CREATE TYPE "DutyRateType" AS ENUM ('PERCENTAGE', 'FIXED', 'BLENDED', 'EXPRESSION');
CREATE TYPE "DutyConfidenceLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');
CREATE TYPE "DutyRuleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED');
CREATE TYPE "DutyRuleSourceType" AS ENUM (
  'GRA_PUBLICATION',
  'ICUMS_EXPORT',
  'BILL_OF_ENTRY',
  'PAYMENT_RECEIPT',
  'TARIFF_SCHEDULE',
  'ADMIN_VERIFIED',
  'UNKNOWN'
);
CREATE TYPE "DutyRoundingMode" AS ENUM ('HALF_UP', 'HALF_EVEN', 'FLOOR', 'CEIL');

-- CreateTable: DutyVehicleProfile
CREATE TABLE "DutyVehicleProfile" (
  "id" TEXT NOT NULL,
  "make" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "manufacturerModel" TEXT,
  "vin" VARCHAR(17),
  "chassis" VARCHAR(64),
  "manufactureYear" INTEGER NOT NULL,
  "manufactureMonth" INTEGER,
  "firstRegistrationDate" TIMESTAMP(3),
  "vehicleCategory" "DutyVehicleCategory",
  "fuelType" "DutyFuelType" NOT NULL,
  "engineCc" INTEGER,
  "powerKw" DECIMAL(8,2),
  "cylinders" INTEGER,
  "seats" INTEGER,
  "grossWeightKg" INTEGER,
  "netWeightKg" INTEGER,
  "hsCode" VARCHAR(16) NOT NULL,
  "hsCodeNormalized" VARCHAR(16),
  "countryOfOrigin" TEXT,
  "countryOfExport" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DutyVehicleProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DutyAssessment
CREATE TABLE "DutyAssessment" (
  "id" TEXT NOT NULL,
  "countryConfigId" TEXT,
  "vehicleProfileId" TEXT NOT NULL,
  "sourceKind" "DutyAssessmentSourceKind" NOT NULL,
  "assessmentStatus" "DutyAssessmentStatus" NOT NULL DEFAULT 'DRAFT',
  "customsOffice" VARCHAR(120),
  "declarationReference" VARCHAR(64),
  "billOfEntryNumber" VARCHAR(64),
  "assessmentDate" TIMESTAMP(3),
  "paymentDate" TIMESTAMP(3),
  "currency" VARCHAR(3) NOT NULL DEFAULT 'GHS',
  "fobForeign" DECIMAL(14,2),
  "fobForeignCurrency" VARCHAR(3),
  "fxRate" DECIMAL(18,8),
  "fobGhs" DECIMAL(14,2),
  "freightGhs" DECIMAL(14,2),
  "insuranceGhs" DECIMAL(14,2),
  "customsValueGhs" DECIMAL(14,2),
  "depreciationPercent" DECIMAL(8,4),
  "totalAssessedGhs" DECIMAL(14,2) NOT NULL,
  "totalPaidGhs" DECIMAL(14,2),
  "varianceGhs" DECIMAL(14,2),
  "documentIdentityHash" VARCHAR(64),
  "primaryDocumentId" TEXT,
  "verificationStatus" "DutyVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "verifiedById" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "importerIdentifierHash" VARCHAR(128),
  "notes" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DutyAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DutyAssessmentLine
CREATE TABLE "DutyAssessmentLine" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "chargeCode" VARCHAR(64),
  "chargeName" TEXT NOT NULL,
  "normalizedChargeKey" VARCHAR(64) NOT NULL,
  "externalTaxCode" VARCHAR(32),
  "taxBaseCode" VARCHAR(32),
  "displayedBaseAmount" DECIMAL(14,2),
  "displayedRate" DECIMAL(18,8),
  "amountExempted" DECIMAL(14,2),
  "amountSuspended" DECIMAL(14,2),
  "amountPayable" DECIMAL(14,2) NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "sourcePage" INTEGER,
  "sourceRow" INTEGER,
  "sourceDocumentKind" "DutyEvidenceKind",
  "matchedReceiptLine" BOOLEAN NOT NULL DEFAULT false,
  "unmatchedReceipt" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DutyAssessmentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DutyEvidenceDocument
CREATE TABLE "DutyEvidenceDocument" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT,
  "documentKind" "DutyEvidenceKind" NOT NULL,
  "fileUrl" TEXT,
  "secureStorageKey" TEXT NOT NULL,
  "checksum" VARCHAR(128) NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "mimeType" VARCHAR(128) NOT NULL,
  "documentDate" TIMESTAMP(3),
  "uploadedById" TEXT,
  "verificationStatus" "DutyVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "archivedAt" TIMESTAMP(3),
  "archivedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DutyEvidenceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DutyRuleSource
CREATE TABLE "DutyRuleSource" (
  "id" TEXT NOT NULL,
  "sourceType" "DutyRuleSourceType" NOT NULL,
  "title" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "officialUrl" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "documentId" TEXT,
  "verificationStatus" "DutyVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DutyRuleSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DutyCalculationRule
CREATE TABLE "DutyCalculationRule" (
  "id" TEXT NOT NULL,
  "countryConfigId" TEXT NOT NULL,
  "profileId" TEXT,
  "chargeKey" VARCHAR(64) NOT NULL,
  "chargeName" TEXT NOT NULL,
  "rateType" "DutyRateType" NOT NULL,
  "rateValue" DECIMAL(18,8),
  "flatAmount" DECIMAL(14,2),
  "taxableBaseExpression" VARCHAR(256) NOT NULL,
  "roundingMode" "DutyRoundingMode" NOT NULL DEFAULT 'HALF_UP',
  "decimalPlaces" INTEGER NOT NULL DEFAULT 2,
  "dependencyOrder" INTEGER NOT NULL DEFAULT 0,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "sourceId" TEXT NOT NULL,
  "status" "DutyRuleStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DutyCalculationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DutyPredictionOutcome
CREATE TABLE "DutyPredictionOutcome" (
  "id" TEXT NOT NULL,
  "calculationId" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "predictedTotal" DECIMAL(14,2) NOT NULL,
  "actualTotal" DECIMAL(14,2) NOT NULL,
  "absoluteError" DECIMAL(14,2) NOT NULL,
  "percentageError" DECIMAL(8,4) NOT NULL,
  "withinRange" BOOLEAN,
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DutyPredictionOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DutyChargeNormalization
CREATE TABLE "DutyChargeNormalization" (
  "id" TEXT NOT NULL,
  "countryConfigId" TEXT NOT NULL,
  "normalizedChargeKey" VARCHAR(64) NOT NULL,
  "displayName" TEXT NOT NULL,
  "category" VARCHAR(32),
  "aliases" JSONB NOT NULL,
  "externalTaxCodes" JSONB,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DutyChargeNormalization_pkey" PRIMARY KEY ("id")
);

-- AlterTable: extend DutyCalculation (additive nullable columns)
ALTER TABLE "DutyCalculation" ADD COLUMN "vehicleProfileId" TEXT;
ALTER TABLE "DutyCalculation" ADD COLUMN "ruleSetVersion" VARCHAR(64);
ALTER TABLE "DutyCalculation" ADD COLUMN "classificationProfileId" TEXT;
ALTER TABLE "DutyCalculation" ADD COLUMN "formulaSnapshotJson" JSONB;
ALTER TABLE "DutyCalculation" ADD COLUMN "lineSnapshotsJson" JSONB;
ALTER TABLE "DutyCalculation" ADD COLUMN "confidenceLevel" "DutyConfidenceLevel";
ALTER TABLE "DutyCalculation" ADD COLUMN "predictedTotalGhs" DECIMAL(14,2);
ALTER TABLE "DutyCalculation" ADD COLUMN "predictedLowGhs" DECIMAL(14,2);
ALTER TABLE "DutyCalculation" ADD COLUMN "predictedHighGhs" DECIMAL(14,2);

-- AlterTable: link DutyVerifiedImport to new assessment foundation
ALTER TABLE "DutyVerifiedImport" ADD COLUMN "vehicleProfileId" TEXT;
ALTER TABLE "DutyVerifiedImport" ADD COLUMN "assessmentId" TEXT;

-- Backfill DutyCalculation without fabricating missing data
UPDATE "DutyCalculation"
SET
  "ruleSetVersion" = "formulaVersion",
  "predictedTotalGhs" = "totalGraTaxesGhs"
WHERE "ruleSetVersion" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DutyAssessment_documentIdentityHash_key" ON "DutyAssessment"("documentIdentityHash");
CREATE UNIQUE INDEX "DutyVerifiedImport_assessmentId_key" ON "DutyVerifiedImport"("assessmentId");
CREATE UNIQUE INDEX "DutyPredictionOutcome_calculationId_assessmentId_key" ON "DutyPredictionOutcome"("calculationId", "assessmentId");
CREATE UNIQUE INDEX "DutyEvidenceDocument_checksum_assessmentId_key" ON "DutyEvidenceDocument"("checksum", "assessmentId");
CREATE UNIQUE INDEX "DutyChargeNormalization_countryConfigId_normalizedChargeKey_key" ON "DutyChargeNormalization"("countryConfigId", "normalizedChargeKey");

CREATE INDEX "DutyVehicleProfile_make_model_manufactureYear_idx" ON "DutyVehicleProfile"("make", "model", "manufactureYear");
CREATE INDEX "DutyVehicleProfile_hsCode_idx" ON "DutyVehicleProfile"("hsCode");
CREATE INDEX "DutyVehicleProfile_hsCodeNormalized_idx" ON "DutyVehicleProfile"("hsCodeNormalized");
CREATE INDEX "DutyVehicleProfile_fuelType_idx" ON "DutyVehicleProfile"("fuelType");
CREATE INDEX "DutyVehicleProfile_vin_idx" ON "DutyVehicleProfile"("vin");
CREATE INDEX "DutyVehicleProfile_chassis_idx" ON "DutyVehicleProfile"("chassis");

CREATE INDEX "DutyAssessment_vehicleProfileId_idx" ON "DutyAssessment"("vehicleProfileId");
CREATE INDEX "DutyAssessment_assessmentDate_idx" ON "DutyAssessment"("assessmentDate");
CREATE INDEX "DutyAssessment_verificationStatus_idx" ON "DutyAssessment"("verificationStatus");
CREATE INDEX "DutyAssessment_billOfEntryNumber_idx" ON "DutyAssessment"("billOfEntryNumber");
CREATE INDEX "DutyAssessment_declarationReference_idx" ON "DutyAssessment"("declarationReference");
CREATE INDEX "DutyAssessment_assessmentStatus_idx" ON "DutyAssessment"("assessmentStatus");
CREATE INDEX "DutyAssessment_customsOffice_billOfEntryNumber_idx" ON "DutyAssessment"("customsOffice", "billOfEntryNumber");
CREATE INDEX "DutyAssessment_countryConfigId_createdAt_idx" ON "DutyAssessment"("countryConfigId", "createdAt");

CREATE INDEX "DutyAssessmentLine_assessmentId_displayOrder_idx" ON "DutyAssessmentLine"("assessmentId", "displayOrder");
CREATE INDEX "DutyAssessmentLine_normalizedChargeKey_idx" ON "DutyAssessmentLine"("normalizedChargeKey");
CREATE INDEX "DutyAssessmentLine_assessmentId_normalizedChargeKey_idx" ON "DutyAssessmentLine"("assessmentId", "normalizedChargeKey");

CREATE INDEX "DutyEvidenceDocument_checksum_idx" ON "DutyEvidenceDocument"("checksum");
CREATE INDEX "DutyEvidenceDocument_assessmentId_documentKind_idx" ON "DutyEvidenceDocument"("assessmentId", "documentKind");
CREATE INDEX "DutyEvidenceDocument_verificationStatus_idx" ON "DutyEvidenceDocument"("verificationStatus");

CREATE INDEX "DutyRuleSource_sourceType_effectiveFrom_idx" ON "DutyRuleSource"("sourceType", "effectiveFrom");
CREATE INDEX "DutyRuleSource_verificationStatus_idx" ON "DutyRuleSource"("verificationStatus");
CREATE INDEX "DutyRuleSource_reference_idx" ON "DutyRuleSource"("reference");

CREATE INDEX "DutyCalculationRule_countryConfigId_chargeKey_status_idx" ON "DutyCalculationRule"("countryConfigId", "chargeKey", "status");
CREATE INDEX "DutyCalculationRule_profileId_chargeKey_idx" ON "DutyCalculationRule"("profileId", "chargeKey");
CREATE INDEX "DutyCalculationRule_effectiveFrom_effectiveTo_idx" ON "DutyCalculationRule"("effectiveFrom", "effectiveTo");
CREATE INDEX "DutyCalculationRule_sourceId_idx" ON "DutyCalculationRule"("sourceId");

CREATE INDEX "DutyPredictionOutcome_assessmentId_idx" ON "DutyPredictionOutcome"("assessmentId");
CREATE INDEX "DutyPredictionOutcome_evaluatedAt_idx" ON "DutyPredictionOutcome"("evaluatedAt");

CREATE INDEX "DutyChargeNormalization_normalizedChargeKey_idx" ON "DutyChargeNormalization"("normalizedChargeKey");
CREATE INDEX "DutyChargeNormalization_active_idx" ON "DutyChargeNormalization"("active");

CREATE INDEX "DutyCalculation_vehicleProfileId_idx" ON "DutyCalculation"("vehicleProfileId");
CREATE INDEX "DutyVerifiedImport_vehicleProfileId_idx" ON "DutyVerifiedImport"("vehicleProfileId");
CREATE INDEX "DutyVerifiedImport_assessmentId_idx" ON "DutyVerifiedImport"("assessmentId");

-- Partial unique: one BoE per customs office when both are present
CREATE UNIQUE INDEX "DutyAssessment_customsOffice_billOfEntryNumber_unique"
  ON "DutyAssessment"("customsOffice", "billOfEntryNumber")
  WHERE "billOfEntryNumber" IS NOT NULL AND "customsOffice" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "DutyVehicleProfile" ADD CONSTRAINT "DutyVehicleProfile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DutyAssessment" ADD CONSTRAINT "DutyAssessment_countryConfigId_fkey" FOREIGN KEY ("countryConfigId") REFERENCES "DutyCountryConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DutyAssessment" ADD CONSTRAINT "DutyAssessment_vehicleProfileId_fkey" FOREIGN KEY ("vehicleProfileId") REFERENCES "DutyVehicleProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DutyAssessment" ADD CONSTRAINT "DutyAssessment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DutyAssessment" ADD CONSTRAINT "DutyAssessment_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DutyAssessmentLine" ADD CONSTRAINT "DutyAssessmentLine_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "DutyAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DutyEvidenceDocument" ADD CONSTRAINT "DutyEvidenceDocument_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "DutyAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DutyEvidenceDocument" ADD CONSTRAINT "DutyEvidenceDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DutyEvidenceDocument" ADD CONSTRAINT "DutyEvidenceDocument_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DutyRuleSource" ADD CONSTRAINT "DutyRuleSource_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DutyEvidenceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DutyRuleSource" ADD CONSTRAINT "DutyRuleSource_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DutyCalculationRule" ADD CONSTRAINT "DutyCalculationRule_countryConfigId_fkey" FOREIGN KEY ("countryConfigId") REFERENCES "DutyCountryConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DutyCalculationRule" ADD CONSTRAINT "DutyCalculationRule_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DutyVehicleProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DutyCalculationRule" ADD CONSTRAINT "DutyCalculationRule_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DutyRuleSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DutyCalculationRule" ADD CONSTRAINT "DutyCalculationRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DutyPredictionOutcome" ADD CONSTRAINT "DutyPredictionOutcome_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "DutyCalculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DutyPredictionOutcome" ADD CONSTRAINT "DutyPredictionOutcome_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "DutyAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DutyChargeNormalization" ADD CONSTRAINT "DutyChargeNormalization_countryConfigId_fkey" FOREIGN KEY ("countryConfigId") REFERENCES "DutyCountryConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DutyCalculation" ADD CONSTRAINT "DutyCalculation_vehicleProfileId_fkey" FOREIGN KEY ("vehicleProfileId") REFERENCES "DutyVehicleProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DutyVerifiedImport" ADD CONSTRAINT "DutyVerifiedImport_vehicleProfileId_fkey" FOREIGN KEY ("vehicleProfileId") REFERENCES "DutyVehicleProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DutyVerifiedImport" ADD CONSTRAINT "DutyVerifiedImport_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "DutyAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
