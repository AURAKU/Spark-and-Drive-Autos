ALTER TABLE "VehicleImportEstimate" ADD COLUMN "carId" TEXT;
CREATE INDEX "VehicleImportEstimate_carId_createdAt_idx" ON "VehicleImportEstimate"("carId","createdAt");
ALTER TABLE "VehicleImportEstimate"
  ADD CONSTRAINT "VehicleImportEstimate_carId_fkey"
  FOREIGN KEY ("carId") REFERENCES "Car"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
