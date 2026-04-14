-- Link product reviews to parts; one row per (userId, partId) when both are non-null.

ALTER TABLE "Review" ADD COLUMN "partId" TEXT;

CREATE INDEX "Review_partId_idx" ON "Review"("partId");
CREATE INDEX "Review_partId_status_idx" ON "Review"("partId", "status");

ALTER TABLE "Review" ADD CONSTRAINT "Review_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Review_userId_partId_key" ON "Review"("userId", "partId");
