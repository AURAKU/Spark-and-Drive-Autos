-- Advanced motorcycle specification fields (groups, units, public/internal visibility).
-- Additive only — existing rows keep defaults (isPublic=true, null group/unit).

ALTER TABLE "MotorcycleSpecification" ADD COLUMN "groupName" TEXT;
ALTER TABLE "MotorcycleSpecification" ADD COLUMN "unit" TEXT;
ALTER TABLE "MotorcycleSpecification" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "MotorcycleSpecification_motorcycleId_sortOrder_idx" ON "MotorcycleSpecification"("motorcycleId", "sortOrder");
