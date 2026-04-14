-- Protection Center: structured security / abuse observations

CREATE TYPE "SecuritySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE "SecurityChannel" AS ENUM (
  'AUTH',
  'PAYMENT',
  'WEBHOOK',
  'RATE_LIMIT',
  'API',
  'ADMIN',
  'FRAUD',
  'MISCONFIG'
);

CREATE TABLE "SecurityObservation" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "severity" "SecuritySeverity" NOT NULL DEFAULT 'MEDIUM',
  "channel" "SecurityChannel" NOT NULL,
  "title" TEXT NOT NULL,
  "detail" TEXT,
  "userId" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "path" TEXT,
  "metadataJson" JSONB,

  CONSTRAINT "SecurityObservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SecurityObservation_createdAt_idx" ON "SecurityObservation"("createdAt");
CREATE INDEX "SecurityObservation_channel_createdAt_idx" ON "SecurityObservation"("channel", "createdAt");
CREATE INDEX "SecurityObservation_severity_createdAt_idx" ON "SecurityObservation"("severity", "createdAt");
CREATE INDEX "SecurityObservation_userId_idx" ON "SecurityObservation"("userId");
CREATE INDEX "SecurityObservation_ipAddress_idx" ON "SecurityObservation"("ipAddress");

ALTER TABLE "SecurityObservation"
  ADD CONSTRAINT "SecurityObservation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
