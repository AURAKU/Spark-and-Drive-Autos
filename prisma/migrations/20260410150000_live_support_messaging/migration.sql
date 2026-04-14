-- User moderation + message edit/delete + optional quote thread link
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "messagingBlocked" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "ChatThread" ADD COLUMN IF NOT EXISTS "quoteId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ChatThread_quoteId_key" ON "ChatThread"("quoteId");

ALTER TABLE "ChatThread" DROP CONSTRAINT IF EXISTS "ChatThread_quoteId_fkey";
ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
