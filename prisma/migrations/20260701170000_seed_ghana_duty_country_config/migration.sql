-- Idempotent Ghana duty country row — full rules are seeded at runtime or via npm run seed:duty
INSERT INTO "DutyCountryConfig" ("id", "countryCode", "name", "currency", "active", "updatedAt")
SELECT
  'cldutyghana00000000000000001',
  'GH'::"DutyCountryCode",
  'Ghana',
  'GHS',
  true,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "DutyCountryConfig" WHERE "countryCode" = 'GH'
);
