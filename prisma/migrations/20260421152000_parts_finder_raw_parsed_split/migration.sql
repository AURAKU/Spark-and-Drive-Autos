ALTER TABLE "PartsFinderSearchSession"
  ADD COLUMN IF NOT EXISTS "rawEvidenceJson" JSONB,
  ADD COLUMN IF NOT EXISTS "parsedResultsJson" JSONB;
