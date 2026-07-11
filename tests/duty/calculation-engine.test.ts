import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeChargeName } from "@/lib/duty-assessment/charge-normalization";
import {
  BYD_SEALION6_CALIBRATION,
  JETOUR_DASHING_CALIBRATION,
} from "@/lib/duty-assessment/fixtures/calibration-cases";
import {
  applyValueOverrides,
  buildChargeOverrideMap,
  buildOverrideAuditSnapshot,
} from "@/lib/duty-intelligence/audit";
import { buildDependencyGraph } from "@/lib/duty-intelligence/dependency-graph";
import {
  runVersionedCalculation,
  runVersionedCalculationFromSnapshot,
} from "@/lib/duty-intelligence/engine-orchestrator";
import { engineError, isEngineError } from "@/lib/duty-intelligence/errors";
import { money, moneyToNumber } from "@/lib/duty-intelligence/money";
import { roundMoney, withinTolerance } from "@/lib/duty-intelligence/rounding";
import { getRuleSetByProfileId } from "@/lib/duty-intelligence/rule-sets/verified-profiles";
import {
  evaluateTaxableBase,
  expressionDependencies,
  parseTaxableBaseExpression,
} from "@/lib/duty-intelligence/taxable-base-expression";
import { DUTY_INTELLIGENCE_FORMULA_VERSION } from "@/lib/duty-intelligence/formula-version";

function lineAmount(
  lines: { chargeKey: string; chargeName: string; amountGhs: number }[],
  key: string,
): number {
  const normalized = normalizeChargeName(key);
  const match = lines.find((l) => l.chargeKey === key || normalizeChargeName(l.chargeName) === normalized);
  assert.ok(match, `Missing line ${key}`);
  return match!.amountGhs;
}

describe("duty calculation engine v4", () => {
  it("uses v4 formula version", () => {
    assert.equal(DUTY_INTELLIGENCE_FORMULA_VERSION, "sda-duty-intelligence-v4");
  });

  it("performs decimal-safe arithmetic without float drift", () => {
    const a = money("153705.29");
    const b = money("0.004");
    const result = moneyToNumber(roundMoney(a.times(b), 2));
    assert.equal(result, 614.82);
  });

  it("parses taxable base expressions", () => {
    assert.deepEqual(parseTaxableBaseExpression("CIF_PLUS_IMPORT_DUTY"), { kind: "ATOM", key: "CIF_PLUS_IMPORT_DUTY" });
    assert.deepEqual(parseTaxableBaseExpression("SELECTED_LINE:NETWORK_CHARGE"), {
      kind: "SELECTED_LINE",
      chargeKey: "NETWORK_CHARGE",
    });
  });

  it("evaluates CIF_PLUS_IMPORT_DUTY after import duty line is set", () => {
    const ctx = {
      fobGhs: money("153705.29"),
      freightGhs: money("10939.39"),
      insuranceGhs: money("1440.7"),
      cifGhs: money("166085.38"),
      customsValueGhs: money("166085.38"),
      lineAmounts: new Map([["IMPORT_DUTY", money("16608.54")]]),
      adminOverrides: new Map(),
      assessedExternalBases: new Map(),
    };
    const base = evaluateTaxableBase("CIF_PLUS_IMPORT_DUTY", ctx);
    assert.equal(moneyToNumber(base), 182693.92);
  });

  it("rejects circular dependencies", () => {
    assert.throws(
      () =>
        buildDependencyGraph([
          {
            chargeKey: "A",
            dependencyOrder: 1,
            taxableBaseExpression: "SELECTED_LINE:B",
          },
          {
            chargeKey: "B",
            dependencyOrder: 2,
            taxableBaseExpression: "SELECTED_LINE:A",
          },
        ]),
      (error: unknown) => isEngineError(error) && error.code === "RULE_DEPENDENCY_ERROR",
    );
  });

  it("orders dependencies before dependents", () => {
    const graph = buildDependencyGraph([
      { chargeKey: "IMPORT_DUTY", dependencyOrder: 10, taxableBaseExpression: "CUSTOMS_VALUE_GHS" },
      { chargeKey: "IMPORT_VAT", dependencyOrder: 70, taxableBaseExpression: "CIF_PLUS_IMPORT_DUTY" },
      { chargeKey: "NETWORK_CHARGE", dependencyOrder: 40, taxableBaseExpression: "FOB_GHS" },
      {
        chargeKey: "NETWORK_CHARGE_VAT",
        dependencyOrder: 60,
        taxableBaseExpression: "SELECTED_LINE:NETWORK_CHARGE",
      },
    ]);
    const keys = graph.ordered.map((n) => n.chargeKey);
    assert.ok(keys.indexOf("IMPORT_DUTY") < keys.indexOf("IMPORT_VAT"));
    assert.ok(keys.indexOf("NETWORK_CHARGE") < keys.indexOf("NETWORK_CHARGE_VAT"));
  });

  it("returns MISSING_RULE_SET when profile has no rules", () => {
    const outcome = runVersionedCalculationFromSnapshot({
      hsCode: "999999",
      fuelType: "GASOLINE",
      manufactureYear: 2020,
      assessmentDate: new Date("2024-06-15"),
      fobGhs: 100000,
      freightGhs: 1000,
      insuranceGhs: 100,
      customsValueGhs: 101100,
      documentedTotalGhs: 50000,
    });
    assert.equal(outcome.ok, false);
    if (outcome.ok) return;
    assert.equal(outcome.error.code, "NEEDS_CLASSIFICATION");
  });

  it("Jetour Dashing — reproduces total and every verified line", () => {
    const fixture = JETOUR_DASHING_CALIBRATION;
    const outcome = runVersionedCalculationFromSnapshot({
      hsCode: fixture.vehicle.hsCode!,
      fuelType: fixture.vehicle.fuelType,
      manufactureYear: fixture.vehicle.manufactureYear,
      engineCc: fixture.vehicle.engineCc,
      vehicleCategory: fixture.vehicle.vehicleCategory,
      assessmentDate: fixture.assessmentDate!,
      fobGhs: fixture.fobGhs!,
      freightGhs: fixture.freightGhs!,
      insuranceGhs: fixture.insuranceGhs!,
      customsValueGhs: fixture.customsValueGhs!,
      documentedTotalGhs: fixture.totalAssessedGhs!,
    });

    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;

    const { engineResult } = outcome;
    assert.equal(engineResult.totalDutyPayableGhs, 61862.67);
    assert.equal(engineResult.valueContext.customsValueGhs, 166085.38);
    assert.equal(engineResult.valueContext.fobGhs, 153705.29);
    assert.ok(engineResult.reconciliation?.withinTolerance);

    for (const expected of fixture.lines) {
      const actual = lineAmount(engineResult.lines, expected.chargeName);
      assert.ok(
        withinTolerance(money(actual), money(expected.amountPayable)),
        `${expected.chargeName}: expected ${expected.amountPayable}, got ${actual}`,
      );
    }

    const keys = engineResult.lines.map((l) => l.chargeKey);
    assert.equal(new Set(keys).size, keys.length, "duplicate charge keys");
  });

  it("BYD Sealion 6 — reproduces total and every verified line", () => {
    const fixture = BYD_SEALION6_CALIBRATION;
    const outcome = runVersionedCalculationFromSnapshot({
      hsCode: fixture.vehicle.hsCode!,
      fuelType: fixture.vehicle.fuelType,
      manufactureYear: fixture.vehicle.manufactureYear,
      powerKw: fixture.vehicle.powerKw,
      vehicleCategory: fixture.vehicle.vehicleCategory,
      assessmentDate: fixture.assessmentDate!,
      fobGhs: fixture.fobGhs!,
      freightGhs: fixture.freightGhs!,
      insuranceGhs: fixture.insuranceGhs!,
      customsValueGhs: fixture.customsValueGhs!,
      documentedTotalGhs: fixture.totalAssessedGhs!,
    });

    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;

    const { engineResult } = outcome;
    assert.equal(engineResult.totalDutyPayableGhs, 151699.89);
    assert.equal(engineResult.valueContext.customsValueGhs, 303143.47);
    assert.equal(engineResult.valueContext.fobGhs, 289900.64);
    assert.ok(engineResult.reconciliation?.withinTolerance);

    for (const expected of fixture.lines) {
      if (expected.amountPayable === 0) continue;
      const actual = lineAmount(engineResult.lines, expected.chargeName);
      assert.ok(
        withinTolerance(money(actual), money(expected.amountPayable)),
        `${expected.chargeName}: expected ${expected.amountPayable}, got ${actual}`,
      );
    }
  });

  it("verified rule sets have no expression dependency gaps", () => {
    for (const profileId of ["GH-HS-870323-VERIFIED-V1", "GH-HS-870380-VERIFIED-V1"]) {
      const ruleSet = getRuleSetByProfileId(profileId);
      assert.ok(ruleSet);
      for (const rule of ruleSet!.rules) {
        const deps = expressionDependencies(rule.taxableBaseExpression);
        for (const dep of deps) {
          assert.ok(
            ruleSet!.rules.some((r) => r.chargeKey === dep),
            `${profileId} ${rule.chargeKey} missing dependency ${dep}`,
          );
        }
      }
    }
  });

  it("structured engine errors expose codes", () => {
    const err = engineError("MISSING_FX_RATE", "FX required");
    assert.equal(err.code, "MISSING_FX_RATE");
    assert.equal(isEngineError(err), true);
  });

  it("preserves admin override audit metadata without mutating rule sets", () => {
    const appliedAt = new Date("2024-06-15T10:00:00.000Z");
    const outcome = runVersionedCalculation({
      assessmentDate: new Date("2024-06-15"),
      documentedTotalGhs: JETOUR_DASHING_CALIBRATION.totalAssessedGhs,
      values: {
        fobGhs: JETOUR_DASHING_CALIBRATION.fobGhs!,
        freightGhs: JETOUR_DASHING_CALIBRATION.freightGhs!,
        insuranceGhs: JETOUR_DASHING_CALIBRATION.insuranceGhs!,
        customsValueGhs: JETOUR_DASHING_CALIBRATION.customsValueGhs!,
        cifGhs: JETOUR_DASHING_CALIBRATION.customsValueGhs!,
      },
      classification: {
        hsCode: JETOUR_DASHING_CALIBRATION.vehicle.hsCode!,
        fuelType: JETOUR_DASHING_CALIBRATION.vehicle.fuelType,
        manufactureYear: JETOUR_DASHING_CALIBRATION.vehicle.manufactureYear,
        engineCc: JETOUR_DASHING_CALIBRATION.vehicle.engineCc,
        vehicleCategory: JETOUR_DASHING_CALIBRATION.vehicle.vehicleCategory,
      },
      adminOverrideRecords: [
        {
          target: "customsValueGhs",
          originalValue: 160000,
          overrideValue: JETOUR_DASHING_CALIBRATION.customsValueGhs!,
          reason: "BoE verified customs value",
          adminId: "admin-001",
          adminDisplayName: "Duty Admin",
          appliedAt,
        },
      ],
    });

    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;

    const audit = outcome.engineResult.overrideAudit;
    assert.ok(audit);
    assert.equal(audit!.snapshotOnly, true);
    assert.equal(audit!.overrides.length, 1);
    assert.equal(audit!.overrides[0]!.originalValue, 160000);
    assert.equal(audit!.overrides[0]!.overrideValue, JETOUR_DASHING_CALIBRATION.customsValueGhs);
    assert.equal(audit!.overrides[0]!.adminId, "admin-001");
    assert.equal(audit!.overrides[0]!.reason, "BoE verified customs value");
    assert.equal(outcome.engineResult.totalDutyPayableGhs, 61862.67);
  });

  it("applies charge-level admin overrides from structured records", () => {
    const chargeMap = buildChargeOverrideMap([
      {
        target: "charge:NETWORK_CHARGE",
        originalValue: 600,
        overrideValue: 614.82,
        reason: "BoE network charge",
        adminId: "admin-002",
        appliedAt: "2024-06-15T10:00:00.000Z",
      },
    ]);
    assert.equal(chargeMap.NETWORK_CHARGE, 614.82);

    const values = applyValueOverrides(
      { fobGhs: 100000, freightGhs: 1000, insuranceGhs: 100 },
      [
        {
          target: "freightGhs",
          originalValue: 1000,
          overrideValue: 1200,
          reason: "Verified freight",
          adminId: "admin-003",
          appliedAt: "2024-06-15T10:00:00.000Z",
        },
      ],
    );
    assert.equal(values.freightGhs, 1200);

    const snapshot = buildOverrideAuditSnapshot([
      {
        target: "freightGhs",
        originalValue: 1000,
        overrideValue: 1200,
        reason: "Verified freight",
        adminId: "admin-003",
        appliedAt: "2024-06-15T10:00:00.000Z",
      },
    ]);
    assert.equal(snapshot.overrides[0]!.originalValue, 1000);
    assert.equal(snapshot.snapshotOnly, true);
  });
});

describe("dependency graph deterministic ordering", () => {
  it("respects explicit dependencyOrder ties", () => {
    const graph = buildDependencyGraph([
      { chargeKey: "IMPORT_DUTY", dependencyOrder: 10, taxableBaseExpression: "CUSTOMS_VALUE_GHS" },
      { chargeKey: "ECOWAS_LEVY", dependencyOrder: 20, taxableBaseExpression: "CIF_GHS" },
    ]);
    assert.deepEqual(
      graph.ordered.map((n) => n.chargeKey),
      ["IMPORT_DUTY", "ECOWAS_LEVY"],
    );
  });
});
