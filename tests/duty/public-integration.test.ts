import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDutyDisclaimer, DUTY_ESTIMATE_DISCLAIMER_DEFAULT } from "@/lib/duty/disclaimer";
import { customerConfidenceLabel, FORBIDDEN_RESULT_PHRASES } from "@/lib/duty-intelligence/result-labels";
import { groupLineItems } from "@/lib/duty-intelligence/line-item-groups";
import { mapFuelType } from "@/lib/duty-intelligence/fuel-type";
import {
  BYD_SEALION6_CALIBRATION,
  JETOUR_DASHING_CALIBRATION,
} from "@/lib/duty-assessment/fixtures/calibration-cases";
import { runVersionedCalculationFromSnapshot } from "@/lib/duty-intelligence/engine-orchestrator";
import { withinTolerance, roundMoney } from "@/lib/duty-intelligence/rounding";
import { money } from "@/lib/duty-intelligence/money";
import { normalizeChargeName } from "@/lib/duty-assessment/charge-normalization";
import { mergeDutyAdminSettings } from "@/lib/duty-admin/settings";
import type { CalculationLineItem } from "@/lib/duty-intelligence/types";

function lineAmount(lines: { chargeKey: string; chargeName: string; amountGhs: number }[], key: string) {
  const normalized = normalizeChargeName(key);
  const match = lines.find((l) => l.chargeKey === key || normalizeChargeName(l.chargeName) === normalized);
  assert.ok(match, `Missing line ${key}`);
  return match!.amountGhs;
}

describe("public duty result labels", () => {
  it("maps confidence levels to customer-safe labels", () => {
    assert.equal(customerConfidenceLabel("VERIFIED_PROFILE_HIGH"), "High-confidence estimate");
    assert.equal(customerConfidenceLabel("LIMITED_EVIDENCE"), "Limited-data estimate");
    assert.equal(customerConfidenceLabel("ADMIN_REVIEW_REQUIRED"), "Admin review recommended");
  });

  it("never uses forbidden guarantee phrases in labels", () => {
    const labels = [
      customerConfidenceLabel("VERIFIED_PROFILE_HIGH"),
      customerConfidenceLabel("STRONG_EVIDENCE"),
      customerConfidenceLabel("LIMITED_EVIDENCE"),
    ];
    for (const label of labels) {
      for (const forbidden of FORBIDDEN_RESULT_PHRASES) {
        assert.ok(!label.toLowerCase().includes(forbidden.toLowerCase()));
      }
    }
  });
});

describe("public duty disclaimer", () => {
  it("includes default planning disclaimer", () => {
    assert.match(DUTY_ESTIMATE_DISCLAIMER_DEFAULT, /estimate for planning/i);
    assert.match(DUTY_ESTIMATE_DISCLAIMER_DEFAULT, /Ghana Revenue Authority/i);
  });

  it("preserves estimate status when admin customizes wording", () => {
    const custom = resolveDutyDisclaimer("Custom company note.");
    assert.match(custom, /estimate/i);
  });

  it("rejects removing estimate status from admin wording", () => {
    const custom = resolveDutyDisclaimer("Final duty amount confirmed.");
    assert.match(custom, /estimate for planning/i);
  });
});

describe("line item grouping", () => {
  it("dedupes lines by code", () => {
    const items: CalculationLineItem[] = [
      { code: "IMPORT_DUTY", label: "Import Duty", category: "DUTY", amountGhs: 100, basis: "CIF", formula: "10%", source: "CONFIG" },
      { code: "IMPORT_DUTY", label: "Import Duty duplicate", category: "DUTY", amountGhs: 100, basis: "CIF", formula: "10%", source: "CONFIG" },
      { code: "IMPORT_VAT", label: "Import VAT", category: "VAT", amountGhs: 50, basis: "CIF+duty", formula: "15%", source: "CONFIG" },
    ];
    const groups = groupLineItems(items);
    const dutyGroup = groups.find((g) => g.group === "CUSTOMS_DUTY");
    assert.equal(dutyGroup?.items.length, 1);
  });
});

describe("fuel type mapping", () => {
  it("maps engine types for EV and hybrid profiles", () => {
    assert.equal(mapFuelType("GASOLINE_PETROL"), "GASOLINE");
    assert.equal(mapFuelType("PLUGIN_HYBRID"), "PLUGIN_HYBRID");
    assert.equal(mapFuelType("ELECTRIC"), "ELECTRIC");
  });
});

describe("final regression — Jetour fixture", () => {
  it("reproduces customs value 166,085.38 and total 61,862.67", () => {
    const f = JETOUR_DASHING_CALIBRATION;
    const outcome = runVersionedCalculationFromSnapshot({
      hsCode: f.vehicle.hsCode!,
      fuelType: f.vehicle.fuelType,
      manufactureYear: f.vehicle.manufactureYear,
      engineCc: f.vehicle.engineCc,
      vehicleCategory: f.vehicle.vehicleCategory,
      assessmentDate: f.assessmentDate!,
      fobGhs: f.fobGhs!,
      freightGhs: f.freightGhs!,
      insuranceGhs: f.insuranceGhs!,
      customsValueGhs: f.customsValueGhs!,
      documentedTotalGhs: f.totalAssessedGhs!,
    });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.engineResult.valueContext.customsValueGhs, 166085.38);
    assert.equal(outcome.engineResult.totalDutyPayableGhs, 61862.67);
    for (const expected of f.lines) {
      const actual = lineAmount(outcome.engineResult.lines, expected.chargeName);
      assert.ok(withinTolerance(money(actual), money(expected.amountPayable)));
    }
    const keys = outcome.engineResult.lines.map((l) => l.chargeKey);
    assert.equal(new Set(keys).size, keys.length);
  });
});

describe("final regression — BYD fixture", () => {
  it("reproduces customs value 303,143.47 and total 151,699.89", () => {
    const f = BYD_SEALION6_CALIBRATION;
    const outcome = runVersionedCalculationFromSnapshot({
      hsCode: f.vehicle.hsCode!,
      fuelType: f.vehicle.fuelType,
      manufactureYear: f.vehicle.manufactureYear,
      powerKw: f.vehicle.powerKw,
      vehicleCategory: f.vehicle.vehicleCategory,
      assessmentDate: f.assessmentDate!,
      fobGhs: f.fobGhs!,
      freightGhs: f.freightGhs!,
      insuranceGhs: f.insuranceGhs!,
      customsValueGhs: f.customsValueGhs!,
      documentedTotalGhs: f.totalAssessedGhs!,
    });
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.engineResult.valueContext.customsValueGhs, 303143.47);
    assert.equal(outcome.engineResult.totalDutyPayableGhs, 151699.89);
    assert.notEqual(outcome.profileId, "GH-HS-870323-VERIFIED-V1", "EV profile must not reuse Jetour ICE profile");
  });
});

describe("admin settings public gate", () => {
  it("supports disabling public calculator", () => {
    const settings = mergeDutyAdminSettings({}, { publicCalculatorEnabled: false });
    assert.equal(settings.publicCalculatorEnabled, false);
  });

  it("configures rate limit threshold", () => {
    const settings = mergeDutyAdminSettings({}, { maxPublicRequestsPerHour: 30 });
    assert.equal(settings.maxPublicRequestsPerHour, 30);
  });
});

describe("historical calculation immutability contract", () => {
  it("rounds money deterministically for snapshots", () => {
    assert.equal(roundMoney(money("61862.675"), 2).toNumber(), 61862.68);
  });
});
