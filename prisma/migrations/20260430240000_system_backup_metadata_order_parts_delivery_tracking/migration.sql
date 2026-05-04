-- Singleton row for backup/readiness tracking (does not imply a successful backup run).
CREATE TABLE IF NOT EXISTS "SystemBackupMetadata" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemBackupMetadata_pkey" PRIMARY KEY ("id")
);

-- Parts orders: international delivery fee policy + customer-quoted lane (checkout charges parts subtotal only).
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "partsIntlShippingFeeStatus" VARCHAR(32) NOT NULL DEFAULT 'MANUAL_PENDING';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingFeeChargedAtCheckout" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "partsCustomerQuotedDeliveryMode" "DeliveryMode";
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "partsCustomerQuotedDeliveryLabel" TEXT;
