import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeChargeKey,
  reconcilePayableDutyLines,
  roundMoney2,
} from "@/lib/duty-intelligence/charge-reconciliation";
import {
  buildValuationChain,
  computeLandedCostGhs,
  resolvePricingBasis,
  roundGhs,
} from "@/lib/duty-intelligence/valuation-resolver";
import { calculateInsuranceAmount } from "@/lib/duty-intelligence/engines/insurance-engine";
import type { CalculationLineItem } from "@/lib/duty-intelligence/types";
import { JETOUR_DASHING_CALIBRATION, BYD_SEALION6_CALIBRATION } from "@/lib/duty-assessment/fixtures/calibration-cases";

test("FOB stays separate from freight; CIF = FOB + freight + insurance", () => {
  const chain = buildValuationChain({
    pricingBasis: "FOB",
    purchaseFobGhs: 100000,
    freightGhs: 5000,
    insuranceGhs: 1575,
  });
  assert.equal(chain.fobGhs, 100000);
  assert.equal(chain.freightGhs, 5000);
  assert.equal(chain.insuranceGhs, 1575);
  assert.equal(chain.cifGhs, 106575);
  assert.equal(chain.cifOverridden, false);
  assert.equal(chain.fobGhs + chain.freightGhs + chain.insuranceGhs, chain.cifGhs);
});

test("CIF override does not treat CIF as FOB and does not double-count freight", () => {
  const freight = 10939.39;
  const insurance = calculateInsuranceAmount({
    fobGhs: 166085.38 - freight,
    freightGhs: freight,
    percentageRate: 0.015,
  });
  const chain = buildValuationChain({
    pricingBasis: "CIF",
    purchaseFobGhs: 166085.38, // legacy mistaken “FOB” = CIF
    freightGhs: freight,
    insuranceGhs: insurance,
    cifGhsOverride: 166085.38,
  });
  assert.equal(chain.cifGhs, 166085.38);
  assert.equal(chain.customsValueGhs, 166085.38);
  assert.ok(chain.fobInferredFromCif);
  assert.ok(chain.fobGhs < chain.cifGhs);
  assert.equal(roundGhs(chain.fobGhs + chain.freightGhs + chain.insuranceGhs), chain.cifGhs);
});

test("CFR basis adds insurance after FOB+freight", () => {
  const chain = buildValuationChain({
    pricingBasis: "CFR",
    purchaseFobGhs: 90000,
    freightGhs: 4000,
    insuranceGhs: 1410,
  });
  assert.equal(chain.cifGhs, 95410);
});

test("resolvePricingBasis defaults and CIF override", () => {
  assert.equal(resolvePricingBasis({}), "FOB");
  assert.equal(resolvePricingBasis({ cifGhsOverride: 100 }), "CIF");
  assert.equal(resolvePricingBasis({ declared: "CFR" }), "CFR");
});

test("insurance uses FOB + freight only", () => {
  const insurance = calculateInsuranceAmount({
    fobGhs: 153705.29,
    freightGhs: 10939.39,
    percentageRate: 0.015,
  });
  assert.equal(insurance, roundMoney2((153705.29 + 10939.39) * 0.015));
});

test("landed cost = customs + duty (no freight double count)", () => {
  assert.equal(computeLandedCostGhs({ customsValueGhs: 166085.38, totalEstimatedDutyPayableGhs: 61862.67 }), 227948.05);
});

test("duplicate charge aliases collapse to one line", () => {
  const items: CalculationLineItem[] = [
    {
      code: "IMPORT_DUTY",
      label: "Import Duty",
      category: "DUTY",
      amountGhs: 40000,
      basis: "CV",
      formula: "20%",
      source: "CONFIG",
    },
    {
      code: "Import Duty",
      label: "Import Duty (receipt)",
      category: "DUTY",
      amountGhs: 40000,
      basis: "CV",
      formula: "20%",
      source: "CONFIG",
    },
    {
      code: "FOB",
      label: "FOB",
      category: "FOB",
      amountGhs: 100000,
      basis: "purchase",
      formula: "fx",
      source: "CONFIG",
    },
  ];
  const recon = reconcilePayableDutyLines(items);
  assert.equal(recon.payableLines.length, 1);
  assert.equal(recon.totalEstimatedDutyPayableGhs, 40000);
  assert.equal(recon.duplicateKeysDropped.includes("IMPORT_DUTY"), true);
  assert.equal(normalizeChargeKey("Import Duty"), "IMPORT_DUTY");
});

test("total equals unique line sum and rejects empty-total mismatch", () => {
  const items: CalculationLineItem[] = [
    {
      code: "IMPORT_DUTY",
      label: "Import Duty",
      category: "DUTY",
      amountGhs: 30000,
      basis: "CV",
      formula: "x",
      source: "CONFIG",
    },
    {
      code: "IMPORT_VAT",
      label: "Import VAT",
      category: "VAT",
      amountGhs: 15000,
      basis: "CV",
      formula: "x",
      source: "CONFIG",
    },
  ];
  const ok = reconcilePayableDutyLines(items, { expectedTotalGhs: 45000 });
  assert.equal(ok.withinTolerance, true);
  assert.equal(ok.totalEstimatedDutyPayableGhs, 45000);

  const bad = reconcilePayableDutyLines(items, { expectedTotalGhs: 99999 });
  assert.equal(bad.withinTolerance, false);
  assert.equal(bad.totalEstimatedDutyPayableGhs, 45000);
});

test("Jetour fixture customs value and total assessable reconcile", () => {
  const fob = 153705.29;
  const freight = 10939.39;
  const insurance = 1440.7;
  const cif = roundGhs(fob + freight + insurance);
  assert.equal(cif, JETOUR_DASHING_CALIBRATION.customsValueGhs);
  assert.equal(JETOUR_DASHING_CALIBRATION.totalAssessedGhs, 61862.67);
  assert.equal(JETOUR_DASHING_CALIBRATION.customsValueGhs, 166085.38);
});

test("BYD fixture customs value and total assessable reconcile", () => {
  const fob = 289900.64;
  const freight = 10613.28;
  const insurance = 2629.55;
  const cif = roundGhs(fob + freight + insurance);
  assert.equal(cif, BYD_SEALION6_CALIBRATION.customsValueGhs);
  assert.equal(BYD_SEALION6_CALIBRATION.totalAssessedGhs, 151699.89);
  assert.equal(BYD_SEALION6_CALIBRATION.customsValueGhs, 303143.47);
});

test("no NaN/undefined in valuation outputs", () => {
  const chain = buildValuationChain({
    pricingBasis: "FOB",
    purchaseFobGhs: Number.NaN,
    freightGhs: Number.NaN,
    insuranceGhs: Number.NaN,
  });
  assert.equal(Number.isFinite(chain.fobGhs), true);
  assert.equal(Number.isFinite(chain.cifGhs), true);
  assert.equal(JSON.stringify(chain).includes("NaN"), false);
  assert.equal(JSON.stringify(chain).includes("undefined"), false);
});
