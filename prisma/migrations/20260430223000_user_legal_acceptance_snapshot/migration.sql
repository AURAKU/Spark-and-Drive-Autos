-- Central legal acceptance audit fields on User (non-destructive; row-level acceptances remain authoritative).

ALTER TABLE "User" ADD COLUMN "legalAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "legalAcceptedVersion" VARCHAR(512);
ALTER TABLE "User" ADD COLUMN "legalAcceptedIp" VARCHAR(64);
ALTER TABLE "User" ADD COLUMN "legalAcceptedUserAgent" VARCHAR(512);
