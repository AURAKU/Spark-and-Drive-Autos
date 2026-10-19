-- Parts request fee. Existing requests stay paid. No inventory or order data is rewritten.
CREATE TABLE IF NOT EXISTS "PartsRequestFeeSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "feeAmount" DECIMAL(14,2) NOT NULL DEFAULT 30,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'GHS',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartsRequestFeeSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PartsRequestFeeSettings" ("id", "enabled", "feeAmount", "currency", "updatedAt")
VALUES ('default', true, 30, 'GHS', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "PartSourcingRequest" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "PartSourcingRequest" ADD COLUMN IF NOT EXISTS "guestName" VARCHAR(120);
ALTER TABLE "PartSourcingRequest" ADD COLUMN IF NOT EXISTS "guestEmail" VARCHAR(160);
ALTER TABLE "PartSourcingRequest" ADD COLUMN IF NOT EXISTS "guestPhone" VARCHAR(40);
ALTER TABLE "PartSourcingRequest" ADD COLUMN IF NOT EXISTS "guestToken" VARCHAR(80);
ALTER TABLE "PartSourcingRequest" ADD COLUMN IF NOT EXISTS "paymentState" VARCHAR(32) NOT NULL DEFAULT 'PAID';
ALTER TABLE "PartSourcingRequest" ADD COLUMN IF NOT EXISTS "feeGhs" DECIMAL(14,2) NOT NULL DEFAULT 30;
ALTER TABLE "PartSourcingRequest" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "PartSourcingRequest" ADD COLUMN IF NOT EXISTS "paymentId" TEXT;
ALTER TABLE "PartSourcingRequest" ADD COLUMN IF NOT EXISTS "chatThreadId" TEXT;

UPDATE "PartSourcingRequest" SET "paidAt" = "createdAt" WHERE "paidAt" IS NULL AND "paymentState" = 'PAID';

CREATE UNIQUE INDEX IF NOT EXISTS "PartSourcingRequest_paymentId_key" ON "PartSourcingRequest"("paymentId");
CREATE INDEX IF NOT EXISTS "PartSourcingRequest_chatThreadId_idx" ON "PartSourcingRequest"("chatThreadId");
CREATE INDEX IF NOT EXISTS "PartSourcingRequest_paymentState_idx" ON "PartSourcingRequest"("paymentState");
