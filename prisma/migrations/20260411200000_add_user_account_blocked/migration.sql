-- User account suspension (separate from Live Support messaging block).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accountBlocked" BOOLEAN NOT NULL DEFAULT false;
