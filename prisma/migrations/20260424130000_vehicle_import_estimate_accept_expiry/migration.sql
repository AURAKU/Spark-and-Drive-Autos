ALTER TABLE "VehicleImportEstimate"
ADD COLUMN "acceptedAt" TIMESTAMP(3),
ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE INDEX "VehicleImportEstimate_acceptedAt_idx" ON "VehicleImportEstimate"("acceptedAt");
CREATE INDEX "VehicleImportEstimate_expiresAt_idx" ON "VehicleImportEstimate"("expiresAt");
