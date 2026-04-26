-- CreateEnum
CREATE TYPE "DeliveryFeeCurrency" AS ENUM ('GHS', 'USD');

-- AlterTable
ALTER TABLE "DeliveryOptionTemplate" ADD COLUMN "feeCurrency" "DeliveryFeeCurrency" NOT NULL DEFAULT 'GHS';
ALTER TABLE "DeliveryOptionTemplate" ADD COLUMN "weightKg" DECIMAL(12, 4);
ALTER TABLE "DeliveryOptionTemplate" ADD COLUMN "volumeCbm" DECIMAL(12, 6);
