import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parsePagination, buildPageHref, paginate } from "@/lib/duty-admin/pagination";
import { parseDutyAdminSettings, mergeDutyAdminSettings } from "@/lib/duty-admin/settings";
import { runVerifiedFixtureRegression, canMutateDraftRule } from "@/lib/duty-admin/rules";
import { detectProfileConflicts } from "@/lib/duty-admin/profiles";
import { isFxRateStale, validateFxRateInput } from "@/lib/duty-admin/fx-rates";
import { isCalibrationEligible } from "@/lib/duty-admin/assessments";
import { ensureNoDatasetLeakage, evaluateCalibrationFixtures } from "@/lib/duty-intelligence/evaluation-metrics";
import { DUTY_ADMIN_NAV } from "@/lib/duty-admin/nav";
import { buildAssessmentIdentityHash } from "@/lib/duty-assessment/identity";
import { reconcileAssessmentLines } from "@/lib/duty-assessment/reconciliation";
import { JETOUR_DASHING_CALIBRATION } from "@/lib/duty-assessment/fixtures/calibration-cases";

describe("duty admin OS foundation", () => {
  it("defines consolidated admin routes", () => {
    const hrefs = DUTY_ADMIN_NAV.map((n) => n.href);
    assert.ok(hrefs.includes("/admin/duty"));
    assert.ok(hrefs.includes("/admin/duty/rules"));
    assert.ok(hrefs.includes("/admin/duty/profiles"));
    assert.ok(hrefs.includes("/admin/duty/hs-codes"));
    assert.ok(hrefs.includes("/admin/duty/fx-rates"));
    assert.ok(hrefs.includes("/admin/duty/valuation"));
    assert.ok(hrefs.includes("/admin/duty/assessments"));
    assert.ok(hrefs.includes("/admin/duty/calculations"));
    assert.ok(hrefs.includes("/admin/duty/calibration"));
    assert.ok(hrefs.includes("/admin/duty/settings"));
    assert.ok(hrefs.includes("/admin/duty/audit"));
  });

  it("parses pagination with defaults", () => {
    const p = parsePagination({});
    assert.equal(p.page, 1);
    assert.equal(p.pageSize, 20);
  });

  it("clamps pagination page size bounds", () => {
    assert.throws(() => parsePagination({ pageSize: "3" }));
    assert.throws(() => parsePagination({ pageSize: "200" }));
  });

  it("paginates in-memory lists", () => {
    const items = Array.from({ length: 25 }, (_, i) => i + 1);
    const page1 = paginate(items, 1, 10);
    assert.equal(page1.items.length, 10);
    assert.equal(page1.totalPages, 3);
    const page3 = paginate(items, 3, 10);
    assert.equal(page3.items.length, 5);
  });

  it("builds page hrefs", () => {
    assert.equal(buildPageHref("/admin/duty/assessments", 2), "/admin/duty/assessments?page=2");
    assert.equal(buildPageHref("/admin/duty/assessments", 1), "/admin/duty/assessments");
    assert.equal(buildPageHref("/admin/duty/assessments", 2, { status: "PENDING" }), "/admin/duty/assessments?status=PENDING&page=2");
  });

  it("merges admin settings without losing defaults", () => {
    const merged = mergeDutyAdminSettings({}, { staleFxThresholdDays: 14 });
    assert.equal(merged.staleFxThresholdDays, 14);
    assert.equal(merged.publicCalculatorEnabled, true);
  });

  it("regression gate passes verified fixtures before publish", () => {
    const preview = runVerifiedFixtureRegression();
    assert.equal(preview.allPassed, true);
    assert.ok(preview.regressionResults.length >= 2);
    assert.ok(preview.regressionResults.some((r) => r.fixtureId === "jetour-dashing"));
    assert.ok(preview.regressionResults.some((r) => r.fixtureId === "byd-sealion6"));
  });

  it("prevents holdout leakage in evaluation fixtures", () => {
    assert.equal(ensureNoDatasetLeakage(evaluateCalibrationFixtures()), true);
  });
});

describe("duty admin settings schema", () => {
  it("parses partial config json", () => {
    const settings = parseDutyAdminSettings({ minimumCalibrationSampleSize: 5 });
    assert.equal(settings.minimumCalibrationSampleSize, 5);
  });

  it("rejects invalid estimate band", () => {
    const settings = parseDutyAdminSettings({ defaultEstimateBandPct: 999 });
    assert.equal(settings.defaultEstimateBandPct, 10);
  });
});

describe("duty admin profile conflicts", () => {
  it("flags overlapping make/model/year with conflicting HS codes", () => {
    const conflicts = detectProfileConflicts([
      { id: "a", make: "Jetour", model: "Dashing", manufactureYear: 2022, hsCode: "870323", fuelType: "GASOLINE", engineCc: 1500, chassis: null },
      { id: "b", make: "Jetour", model: "Dashing", manufactureYear: 2022, hsCode: "870380", fuelType: "GASOLINE", engineCc: 1500, chassis: null },
    ]);
    assert.equal(conflicts.length, 1);
    assert.match(conflicts[0]!.reason, /HS codes/);
  });

  it("allows distinct chassis disambiguation", () => {
    const conflicts = detectProfileConflicts([
      { id: "a", make: "Jetour", model: "Dashing", manufactureYear: 2022, hsCode: "870323", fuelType: "GASOLINE", engineCc: 1500, chassis: "VIN1" },
      { id: "b", make: "Jetour", model: "Dashing", manufactureYear: 2022, hsCode: "870380", fuelType: "GASOLINE", engineCc: 1500, chassis: "VIN2" },
    ]);
    assert.equal(conflicts.length, 0);
  });
});

describe("duty admin FX rates", () => {
  it("detects stale rates by threshold", () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    assert.equal(isFxRateStale(old, 7), true);
    assert.equal(isFxRateStale(new Date(), 7), false);
  });

  it("requires override reason for manual overrides", () => {
    const result = validateFxRateInput({
      fromCurrency: "USD",
      rate: 12.5,
      effectiveDate: new Date(),
      source: "MANUAL_OVERRIDE",
      isOverride: true,
    });
    assert.equal(result.ok, false);
  });

  it("accepts valid FX input", () => {
    const result = validateFxRateInput({
      fromCurrency: "USD",
      rate: 12.5,
      effectiveDate: new Date(),
      source: "BANK_OF_GHANA",
      isOverride: false,
    });
    assert.equal(result.ok, true);
  });
});

describe("duty admin assessment workflows", () => {
  it("detects duplicate assessment identity hashes", () => {
    const a = buildAssessmentIdentityHash({ billOfEntryNumber: "BOE-99", customsOffice: "Tema", totalAssessedGhs: 1000 });
    const b = buildAssessmentIdentityHash({ billOfEntryNumber: "BOE-99", customsOffice: "Tema", totalAssessedGhs: 1000 });
    assert.equal(a, b);
  });

  it("reconciles receipt lines to BoE charges", () => {
    const result = reconcileAssessmentLines({
      billOfEntryLines: JETOUR_DASHING_CALIBRATION.lines,
      receiptLines: [{ chargeName: "Import VAT", amountPayable: 27404.09 }],
    });
    assert.ok(result.matchedKeys.includes("IMPORT_VAT"));
  });

  it("tracks calibration eligibility in notes tags", () => {
    assert.equal(isCalibrationEligible("verified\n[calibration:eligible]"), true);
    assert.equal(isCalibrationEligible("[calibration:ineligible]"), false);
    assert.equal(isCalibrationEligible(null), false);
  });
});

describe("duty admin rule immutability", () => {
  it("only allows editing draft rules", () => {
    assert.equal(canMutateDraftRule("DRAFT"), true);
    assert.equal(canMutateDraftRule("ACTIVE"), false);
    assert.equal(canMutateDraftRule("SUPERSEDED"), false);
    assert.equal(canMutateDraftRule("ARCHIVED"), false);
  });
});
