-- Audit trail for admin broadcasts (in-app notifications still stored per-user in Notification).
CREATE TABLE "SystemAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "recipientCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "SystemAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SystemAnnouncement_createdAt_idx" ON "SystemAnnouncement"("createdAt");

ALTER TABLE "SystemAnnouncement" ADD CONSTRAINT "SystemAnnouncement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
