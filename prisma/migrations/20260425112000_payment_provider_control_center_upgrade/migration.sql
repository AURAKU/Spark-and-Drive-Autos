-- AlterTable
ALTER TABLE "PaymentProviderConfig"
  ADD COLUMN "providerType" TEXT NOT NULL DEFAULT 'PAYSTACK',
  ADD COLUMN "supportedCurrencies" TEXT[] NOT NULL DEFAULT ARRAY['GHS']::TEXT[],
  ADD COLUMN "supportedPaymentTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "updatedById" TEXT;

-- AlterTable
ALTER TABLE "PaymentWebhookEvent"
  ADD COLUMN "reference" TEXT;

-- CreateIndex
CREATE INDEX "PaymentProviderConfig_providerType_enabled_isDefault_idx"
  ON "PaymentProviderConfig"("providerType", "enabled", "isDefault");

CREATE INDEX "PaymentWebhookEvent_reference_createdAt_idx"
  ON "PaymentWebhookEvent"("reference", "createdAt");

CREATE INDEX "PaymentWebhookEvent_event_createdAt_idx"
  ON "PaymentWebhookEvent"("event", "createdAt");

-- AddForeignKey
ALTER TABLE "PaymentProviderConfig"
  ADD CONSTRAINT "PaymentProviderConfig_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentProviderConfig"
  ADD CONSTRAINT "PaymentProviderConfig_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
