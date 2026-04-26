ALTER TABLE "UserVehicle"
ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "nextServiceReminder" TIMESTAMP(3);

CREATE INDEX "UserVehicle_userId_vin_idx" ON "UserVehicle"("userId", "vin");
