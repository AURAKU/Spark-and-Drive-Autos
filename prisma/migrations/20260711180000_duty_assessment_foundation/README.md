# Migration: duty_assessment_foundation

## Summary

Additive migration introducing the verified assessment data foundation for Ghana duty calibration.

## New tables

- `DutyVehicleProfile` — reusable vehicle identity (make, model, HS, fuel, dimensions)
- `DutyAssessment` — official BoE / combined assessment container
- `DutyAssessmentLine` — normalized charge lines with `normalizedChargeKey`
- `DutyEvidenceDocument` — secure document storage references (checksum dedup)
- `DutyRuleSource` — evidence-linked rule/rate governance metadata
- `DutyCalculationRule` — future formula engine rules (Prompt 3)
- `DutyPredictionOutcome` — estimate vs actual variance tracking
- `DutyChargeNormalization` — ICUMS/BoE label alias dictionary

## Extended tables

- `DutyCalculation` — adds `ruleSetVersion`, snapshots, confidence range fields (nullable)
- `DutyVerifiedImport` — optional links to `vehicleProfileId` and `assessmentId`

## Backfill (non-destructive)

```sql
UPDATE "DutyCalculation"
SET
  "ruleSetVersion" = "formulaVersion",
  "predictedTotalGhs" = "totalGraTaxesGhs"
WHERE "ruleSetVersion" IS NULL;
```

No fabricated assessment data is inserted by this migration.

## Indexes

- HS code, fuel type, make/model/year on profiles
- Assessment date, verification status, bill reference on assessments
- Partial unique on `(customsOffice, billOfEntryNumber)` when both present
- Document checksum deduplication per assessment

## Calibration seed (explicit command only)

```bash
SEED_DUTY_CALIBRATION=1 npm run seed:duty-calibration
```

Requires existing Ghana `DutyCountryConfig` row.

## Rollback note

Drop new tables in reverse FK order. Extended columns on `DutyCalculation` / `DutyVerifiedImport` may be dropped if rollback required — existing JSON snapshots remain intact.
