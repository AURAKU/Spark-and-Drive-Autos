-- Enum remap for workflow statuses
ALTER TYPE "VehicleImportEstimateStatus" RENAME TO "VehicleImportEstimateStatus_old";
CREATE TYPE "VehicleImportEstimateStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'EXPIRED', 'SUPERSEDED');

ALTER TABLE "VehicleImportEstimate"
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "status" TYPE "VehicleImportEstimateStatus"
USING (
  CASE
    WHEN "status"::text = 'DRAFT' THEN 'DRAFT'::"VehicleImportEstimateStatus"
    WHEN "status"::text = 'SAVED' THEN 'DRAFT'::"VehicleImportEstimateStatus"
    WHEN "status"::text = 'FINALIZED' THEN 'SENT'::"VehicleImportEstimateStatus"
    ELSE 'DRAFT'::"VehicleImportEstimateStatus"
  END
),
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

DROP TYPE "VehicleImportEstimateStatus_old";

CREATE TABLE "VehicleImportEstimateEvent" (
  "id" TEXT NOT NULL,
  "estimateId" TEXT NOT NULL,
  "status" "VehicleImportEstimateStatus" NOT NULL,
  "note" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VehicleImportEstimateEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VehicleImportEstimateEvent_estimateId_createdAt_idx" ON "VehicleImportEstimateEvent"("estimateId","createdAt");
CREATE INDEX "VehicleImportEstimateEvent_status_createdAt_idx" ON "VehicleImportEstimateEvent"("status","createdAt");

ALTER TABLE "VehicleImportEstimateEvent"
  ADD CONSTRAINT "VehicleImportEstimateEvent_estimateId_fkey"
  FOREIGN KEY ("estimateId") REFERENCES "VehicleImportEstimate"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VehicleImportEstimateEvent"
  ADD CONSTRAINT "VehicleImportEstimateEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
