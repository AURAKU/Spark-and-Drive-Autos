-- Create user vehicle garage table for reusable vehicle profiles.
CREATE TABLE "UserVehicle" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "vin" TEXT,
  "make" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "engine" TEXT,
  "trim" TEXT,
  "nickname" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserVehicle_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UserVehicle"
ADD CONSTRAINT "UserVehicle_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "UserVehicle_userId_createdAt_idx" ON "UserVehicle"("userId", "createdAt");
CREATE INDEX "UserVehicle_userId_make_model_year_idx" ON "UserVehicle"("userId", "make", "model", "year");
CREATE INDEX "UserVehicle_vin_idx" ON "UserVehicle"("vin");
