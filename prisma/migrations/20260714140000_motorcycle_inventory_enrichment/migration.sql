-- Motorcycle inventory enrichment: soft-delete, optimistic version, chassis fields, media metadata.
-- Additive / nullable only — preserves all existing motorcycle rows and media.

ALTER TABLE "Motorcycle" ADD COLUMN "cylinders" INTEGER;
ALTER TABLE "Motorcycle" ADD COLUMN "gears" INTEGER;
ALTER TABLE "Motorcycle" ADD COLUMN "clutchType" TEXT;
ALTER TABLE "Motorcycle" ADD COLUMN "absEquipped" BOOLEAN;
ALTER TABLE "Motorcycle" ADD COLUMN "tractionControl" BOOLEAN;
ALTER TABLE "Motorcycle" ADD COLUMN "lengthMm" INTEGER;
ALTER TABLE "Motorcycle" ADD COLUMN "widthMm" INTEGER;
ALTER TABLE "Motorcycle" ADD COLUMN "heightMm" INTEGER;
ALTER TABLE "Motorcycle" ADD COLUMN "wheelbaseMm" INTEGER;
ALTER TABLE "Motorcycle" ADD COLUMN "groundClearanceMm" INTEGER;
ALTER TABLE "Motorcycle" ADD COLUMN "frontTyre" TEXT;
ALTER TABLE "Motorcycle" ADD COLUMN "rearTyre" TEXT;
ALTER TABLE "Motorcycle" ADD COLUMN "frontBrake" TEXT;
ALTER TABLE "Motorcycle" ADD COLUMN "rearBrake" TEXT;
ALTER TABLE "Motorcycle" ADD COLUMN "frontSuspension" TEXT;
ALTER TABLE "Motorcycle" ADD COLUMN "rearSuspension" TEXT;
ALTER TABLE "Motorcycle" ADD COLUMN "manufactureDate" TEXT;
ALTER TABLE "Motorcycle" ADD COLUMN "previousOwners" INTEGER;
ALTER TABLE "Motorcycle" ADD COLUMN "registrationStatus" TEXT;
ALTER TABLE "Motorcycle" ADD COLUMN "knownIssues" TEXT;
ALTER TABLE "Motorcycle" ADD COLUMN "serviceHistory" TEXT;
ALTER TABLE "Motorcycle" ADD COLUMN "sellingPoints" TEXT;
ALTER TABLE "Motorcycle" ADD COLUMN "adminNotes" TEXT;
ALTER TABLE "Motorcycle" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Motorcycle" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Motorcycle" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "Motorcycle_deletedAt_idx" ON "Motorcycle"("deletedAt");
CREATE INDEX "Motorcycle_archivedAt_idx" ON "Motorcycle"("archivedAt");

ALTER TABLE "MotorcycleImage" ADD COLUMN "caption" TEXT;
ALTER TABLE "MotorcycleImage" ADD COLUMN "width" INTEGER;
ALTER TABLE "MotorcycleImage" ADD COLUMN "height" INTEGER;

ALTER TABLE "MotorcycleVideo" ADD COLUMN "caption" TEXT;
ALTER TABLE "MotorcycleVideo" ADD COLUMN "width" INTEGER;
ALTER TABLE "MotorcycleVideo" ADD COLUMN "height" INTEGER;
ALTER TABLE "MotorcycleVideo" ADD COLUMN "fileSizeBytes" INTEGER;
