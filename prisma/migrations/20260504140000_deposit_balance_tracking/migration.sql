-- CreateEnum
CREATE TYPE "OrderBalanceStatus" AS ENUM ('CURRENT', 'DUE_SOON', 'OVERDUE', 'PAID');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "vehicleListPriceGhs" DECIMAL(14,2),
ADD COLUMN "baseAmount" DECIMAL(18,2),
ADD COLUMN "balanceDueAt" TIMESTAMP(3),
ADD COLUMN "balanceReminderCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastBalanceReminderAt" TIMESTAMP(3),
ADD COLUMN "balanceStatus" "OrderBalanceStatus",
ADD COLUMN "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "balanceCollectionNote" TEXT,
ADD COLUMN "manualBalancePaymentRef" VARCHAR(160),
ADD COLUMN "balanceMarkedPaidAt" TIMESTAMP(3),
ADD COLUMN "balanceMarkedPaidById" TEXT;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_balanceMarkedPaidById_fkey" FOREIGN KEY ("balanceMarkedPaidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Order_balanceDueAt_idx" ON "Order"("balanceDueAt");

-- CreateIndex
CREATE INDEX "Order_balanceStatus_idx" ON "Order"("balanceStatus");

-- CreateIndex
CREATE INDEX "Order_followUpRequired_idx" ON "Order"("followUpRequired");
