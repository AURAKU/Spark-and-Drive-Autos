import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parsePagination, buildPageHref } from "@/lib/duty-admin/pagination";
import { parseDutyAdminSettings, mergeDutyAdminSettings } from "@/lib/duty-admin/settings";
import { runVerifiedFixtureRegression } from "@/lib/duty-admin/rules";
import { ensureNoDatasetLeakage, evaluateCalibrationFixtures } from "@/lib/duty-intelligence/evaluation-metrics";
import { DUTY_ADMIN_NAV } from "@/lib/duty-admin/nav";

describe("duty admin OS foundation", () => {
  it("defines consolidated admin routes", () => {
    const hrefs = DUTY_ADMIN_NAV.map((n) => n.href);
    assert.ok(hrefs.includes("/admin/duty"));
    assert.ok(hrefs.includes("/admin/duty/rules"));
    assert.ok(hrefs.includes("/admin/duty/assessments"));
    assert.ok(hrefs.includes("/admin/duty/calculations"));
    assert.ok(hrefs.includes("/admin/duty/calibration"));
    assert.ok(hrefs.includes("/admin/duty/audit"));
  });

  it("parses pagination with defaults", () => {
    const p = parsePagination({});
    assert.equal(p.page, 1);
    assert.equal(p.pageSize, 20);
  });

  it("builds page hrefs", () => {
    assert.equal(buildPageHref("/admin/duty/assessments", 2), "/admin/duty/assessments?page=2");
    assert.equal(buildPageHref("/admin/duty/assessments", 1), "/admin/duty/assessments");
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
});
