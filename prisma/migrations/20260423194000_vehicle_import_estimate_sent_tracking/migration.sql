ALTER TABLE "VehicleImportEstimate"
ADD COLUMN "sentAt" TIMESTAMP(3),
ADD COLUMN "sentByUserId" TEXT;

CREATE INDEX "VehicleImportEstimate_sentAt_idx" ON "VehicleImportEstimate"("sentAt");

ALTER TABLE "VehicleImportEstimate"
ADD CONSTRAINT "VehicleImportEstimate_sentByUserId_fkey"
FOREIGN KEY ("sentByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
