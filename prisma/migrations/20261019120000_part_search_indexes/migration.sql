-- Additive indexes for OEM and alternate part-number lookup. No data rewrite.
CREATE INDEX IF NOT EXISTS "Part_oemNumber_idx" ON "Part"("oemNumber");
CREATE INDEX IF NOT EXISTS "Part_partNumber_idx" ON "Part"("partNumber");
