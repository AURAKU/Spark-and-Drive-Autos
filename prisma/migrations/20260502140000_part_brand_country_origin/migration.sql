-- Optional admin metadata: part manufacturer brand and country of manufacture (separate from origin lane).

ALTER TABLE "Part" ADD COLUMN "brand" VARCHAR(80);
ALTER TABLE "Part" ADD COLUMN "countryOfOrigin" VARCHAR(80);
