-- Remove duplicate part reviews per (userId, partId), keeping the row with latest updatedAt (then id).
-- Safe when run multiple times; no-op if no duplicates.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "partId"
      ORDER BY "updatedAt" DESC, id DESC
    ) AS rn
  FROM "Review"
  WHERE "userId" IS NOT NULL
    AND "partId" IS NOT NULL
)
DELETE FROM "Review" r
USING ranked x
WHERE r.id = x.id
  AND x.rn > 1;
