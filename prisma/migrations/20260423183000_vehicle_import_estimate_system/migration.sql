-- CreateEnum
CREATE TYPE "VehicleImportEstimateStatus" AS ENUM ('DRAFT', 'SAVED', 'FINALIZED');

-- CreateTable
CREATE TABLE "VehicleImportEstimate" (
    "id" TEXT NOT NULL,
    "estimateNumber" TEXT NOT NULL,
    "status" "VehicleImportEstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "clientName" TEXT NOT NULL,
    "clientContact" TEXT NOT NULL,
    "vehicleName" TEXT NOT NULL,
    "modelYear" INTEGER,
    "vin" TEXT,
    "fob" DECIMAL(14,2),
    "freight" DECIMAL(14,2),
    "insurance" DECIMAL(14,2),
    "cif" DECIMAL(14,2),
    "estimatedDutyRangeMin" DECIMAL(14,2),
    "estimatedDutyRangeMax" DECIMAL(14,2),
    "estimatedLandedCost" DECIMAL(14,2),
    "importantNotice" TEXT,
    "preparedByName" TEXT NOT NULL DEFAULT 'Spark and Drive Autos',
    "preparedByUserId" TEXT,
    "customerId" TEXT,
    "orderId" TEXT,
    "inquiryId" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleImportEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleImportEstimate_estimateNumber_key" ON "VehicleImportEstimate"("estimateNumber");

-- CreateIndex
CREATE INDEX "VehicleImportEstimate_status_updatedAt_idx" ON "VehicleImportEstimate"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "VehicleImportEstimate_customerId_createdAt_idx" ON "VehicleImportEstimate"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "VehicleImportEstimate_orderId_createdAt_idx" ON "VehicleImportEstimate"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "VehicleImportEstimate_inquiryId_createdAt_idx" ON "VehicleImportEstimate"("inquiryId", "createdAt");

-- AddForeignKey
ALTER TABLE "VehicleImportEstimate" ADD CONSTRAINT "VehicleImportEstimate_preparedByUserId_fkey" FOREIGN KEY ("preparedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleImportEstimate" ADD CONSTRAINT "VehicleImportEstimate_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleImportEstimate" ADD CONSTRAINT "VehicleImportEstimate_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleImportEstimate" ADD CONSTRAINT "VehicleImportEstimate_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
