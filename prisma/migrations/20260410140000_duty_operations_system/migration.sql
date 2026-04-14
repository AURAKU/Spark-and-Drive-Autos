-- Duty estimation & operations (vehicle imports). Safe additive migration.

CREATE TYPE "DutyWorkflowStage" AS ENUM (
  'NOT_STARTED',
  'DUTY_ESTIMATE_GENERATED',
  'AWAITING_ARRIVAL',
  'ARRIVED_AT_PORT',
  'AWAITING_OFFICIAL_ASSESSMENT',
  'DUTY_CONFIRMED',
  'AWAITING_DUTY_PAYMENT',
  'DUTY_PAYMENT_IN_PROGRESS',
  'DUTY_PAID',
  'CLEARANCE_IN_PROGRESS',
  'CLEARED',
  'DELIVERED_READY_FOR_PICKUP'
);

ALTER TABLE "DutyRecord" ADD COLUMN     "shipmentId" TEXT;
ALTER TABLE "DutyRecord" ADD COLUMN     "workflowStage" "DutyWorkflowStage" NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE "DutyRecord" ADD COLUMN     "estimateJson" JSONB;
ALTER TABLE "DutyRecord" ADD COLUMN     "estimateTotalGhs" DECIMAL(14,2);
ALTER TABLE "DutyRecord" ADD COLUMN     "formulaVersion" VARCHAR(40);
ALTER TABLE "DutyRecord" ADD COLUMN     "assessedDutyGhs" DECIMAL(14,2);
ALTER TABLE "DutyRecord" ADD COLUMN     "customerVisibleNote" TEXT;
ALTER TABLE "DutyRecord" ADD COLUMN     "internalNote" TEXT;
ALTER TABLE "DutyRecord" ADD COLUMN     "updatedById" TEXT;

ALTER TABLE "DutyRecord" ADD CONSTRAINT "DutyRecord_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DutyRecord" ADD CONSTRAINT "DutyRecord_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DutyRecord_shipmentId_idx" ON "DutyRecord"("shipmentId");
CREATE INDEX "DutyRecord_workflowStage_idx" ON "DutyRecord"("workflowStage");
