import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDutyReportData,
  formatReportMoney,
  maskVinOrChassis,
  moneyNumber,
  uniqueDutyChargeLines,
} from "@/lib/duty-intelligence/report-model";
import { dutyReportPdfFilename } from "@/lib/duty-intelligence/report-pdf";
import { signDutyReportAccessToken, verifyDutyReportAccessToken } from "@/lib/duty-intelligence/report-access";
import type { CalculationLineItem, DutyIntelligenceResult } from "@/lib/duty-intelligence/types";

process.env.AUTH_SECRET ??= "ci-placeholder-auth-secret-min-32-chars!!";

function sampleResult(overrides: Partial<DutyIntelligenceResult> = {}): DutyIntelligenceResult {
  const base: DutyIntelligenceResult = {
    formulaVersion: "test-1",
    countryCode: "GH",
    inputs: {
      countryCode: "GH",
      vehicle: {
        manufacturer: "Jetour",
        model: "Dashing",
        year: 2023,
        countryOfOrigin: "CHINA",
        vehicleCategory: "SUV",
        fuelType: "GASOLINE_PETROL",
        engineCc: 1600,
        transmission: "Automatic",
        driveType: "2WD",
        applyEvDutyWaiver: false,
      },
      purchase: { fobAmount: 18000, fobCurrency: "USD" },
      shipping: { shippingMethod: "SEA_FREIGHT", otherShippingChargesGhs: 0 },
    },
    stages: [],
    lineItems: [
      {
        code: "FOB",
        label: "FOB",
        category: "FOB",
        amountGhs: 210000,
        basis: "purchase",
        formula: "fx",
        source: "CONFIG",
      },
      {
        code: "IMPORT_DUTY",
        label: "Import Duty",
        category: "DUTY",
        amountGhs: 42000,
        basis: "customs value",
        formula: "20%",
        rate: 20,
        rateType: "PERCENT",
        source: "CONFIG",
      },
      {
        code: "IMPORT_DUTY",
        label: "Import Duty duplicate",
        category: "DUTY",
        amountGhs: 42000,
        basis: "customs value",
        formula: "20%",
        rate: 20,
        source: "CONFIG",
      },
      {
        code: "IMPORT_VAT",
        label: "Import VAT",
        category: "VAT",
        amountGhs: 31500,
        basis: "CIF + duty",
        formula: "15%",
        rate: 15,
        rateType: "PERCENT",
        source: "CONFIG",
      },
      {
        code: "ECOWAS",
        label: "ECOWAS Levy",
        category: "LEVY",
        amountGhs: 1050,
        basis: "CIF",
        formula: "0.5%",
        rate: 0.5,
        rateType: "PERCENT",
        source: "CONFIG",
      },
      {
        code: "PORT_FEE",
        label: "Port admin fee",
        category: "PORT",
        amountGhs: 800,
        basis: "fixed",
        formula: "fixed",
        source: "CONFIG",
      },
    ],
    summary: {
      fobGhs: 210000,
      freightGhs: 12000,
      insuranceGhs: 2100,
      cifGhs: 224100,
      customsValueGhs: 224100,
      totalGraTaxesGhs: 74550,
      totalPortChargesGhs: 800,
      shippingLineChargesGhs: 0,
      agentFeesGhs: 0,
      totalLandedCostGhs: 298550,
      estimatedTransitDays: 45,
    },
    calculatedAt: new Date().toISOString(),
    hsCode: "8703.23",
    hsCodeResolution: { code: "8703.23", description: "SUV", method: "profile" },
    exchangeRate: {
      rate: 11.65,
      source: "Admin FX",
      fromCurrency: "USD",
      effectiveDate: "2026-07-01",
    },
    vehicleClassification: {
      category: "SUV",
      ageYears: 3,
      commercial: false,
      profile: "Petrol SUV",
    },
    confidence: {
      score: 78,
      label: "HIGH",
      level: "STRONG_EVIDENCE",
      similarImportCount: 12,
      basisNote: "Similar imports",
      reasons: ["Verified fuel type", "Complete FOB"],
      uncertaintyReasons: ["Freight estimated"],
    },
    historicalComparison: null,
    predictionAdjustments: [],
    methodologyNote: "Test methodology",
    ruleSetVersion: "GH-2026.1",
    estimateRange: {
      baseGhs: 74550,
      lowGhs: 70000,
      highGhs: 80000,
      bandPct: 8,
      expectedGhs: 74550,
      landedCostLowGhs: 290000,
      landedCostExpectedGhs: 298550,
      landedCostHighGhs: 310000,
    },
    explanation: {
      profileUsed: "Petrol SUV",
      majorAssumptions: ["Sea freight matrix applied"],
      whyRangeShown: "Band from similar imports",
      couldChangeFinalAmount: ["Customs valuation"],
      uncertaintyReasons: ["Final clearing fees vary"],
      effectiveRuleDate: "2026-01-01",
      fxRateUsed: 11.65,
      fxSource: "Admin FX",
      customsValueMethod: "CIF",
      cohortSize: 12,
      exactFixtureMatch: false,
    },
  };
  return { ...base, ...overrides };
}

test("uniqueDutyChargeLines removes FOB/valuation and duplicates", () => {
  const lines = uniqueDutyChargeLines(sampleResult().lineItems);
  assert.equal(lines.filter((l) => l.code === "IMPORT_DUTY").length, 1);
  assert.equal(lines.some((l) => l.category === "FOB"), false);
  assert.ok(lines.some((l) => l.code === "IMPORT_VAT"));
});

test("buildDutyReportData for gasoline Jetour-style estimate", () => {
  const report = buildDutyReportData({
    calculationId: "calc_1",
    reportReference: "DI-TEST1234",
    generatedAt: "2026-07-14T00:00:00.000Z",
    inputJson: sampleResult().inputs,
    resultJson: sampleResult(),
  });
  assert.equal(report.vehicle.make, "Jetour");
  assert.equal(report.vehicle.engineCc, 1600);
  assert.equal(report.totals.estimatedDutyPayableGhs, 74550);
  assert.equal(report.totals.estimatedLandedCostGhs, 298550);
  assert.equal(report.confidence.label, "Standard estimate");
  assert.ok(report.dutyLines.every((l) => l.code !== "FOB"));
  assert.equal(report.dutyLines.filter((l) => l.code === "IMPORT_DUTY").length, 1);
  assert.match(formatReportMoney(report.totals.estimatedLandedCostGhs), /298/);
});

test("buildDutyReportData for EV BYD-style estimate", () => {
  const result = sampleResult({
    inputs: {
      countryCode: "GH",
      vehicle: {
        manufacturer: "BYD",
        model: "Sea Lion",
        year: 2025,
        countryOfOrigin: "CHINA",
        vehicleCategory: "SUV",
        fuelType: "ELECTRIC",
        applyEvDutyWaiver: true,
        transmission: "Automatic",
        driveType: "FWD",
      },
      purchase: { fobAmount: 22000, fobCurrency: "USD" },
      shipping: { shippingMethod: "SEA_FREIGHT", otherShippingChargesGhs: 0 },
    },
    vehicleSpec: {
      source: "infer",
      confidence: "medium",
      inferredFields: { powerKw: { value: 150, source: "catalog" } },
      needsConfirmation: [],
    },
    confidence: {
      score: 55,
      label: "MEDIUM",
      level: "LIMITED_EVIDENCE",
      similarImportCount: 2,
      basisNote: "Limited EV cohort",
      reasons: ["EV profile"],
      uncertaintyReasons: ["Limited verified EV shipments"],
    },
  });
  const report = buildDutyReportData({
    calculationId: "calc_ev",
    reportReference: "DI-EV0001",
    generatedAt: new Date(),
    inputJson: result.inputs,
    resultJson: result,
  });
  assert.equal(report.vehicle.make, "BYD");
  assert.equal(report.vehicle.fuelType, "Electric (BEV)");
  assert.equal(report.vehicle.powerKw, 150);
  assert.equal(report.vehicle.engineCc, null);
  assert.equal(report.confidence.label, "Limited-data estimate");
});

test("maskVinOrChassis and moneyNumber are Decimal-safe", () => {
  assert.equal(maskVinOrChassis("LFV3A28K0N3123456"), "LFV3••••3456");
  assert.equal(moneyNumber({ toString: () => "12.345" }), 12.35);
  assert.equal(moneyNumber(null), 0);
});

test("missing optional vehicle fields do not emit undefined strings", () => {
  const result = sampleResult();
  result.inputs.vehicle.transmission = undefined;
  result.inputs.vehicle.driveType = undefined;
  result.inputs.vehicle.vin = undefined;
  const report = buildDutyReportData({
    calculationId: "x",
    reportReference: "DI-X",
    generatedAt: new Date(),
    inputJson: result.inputs,
    resultJson: result,
  });
  assert.equal(report.vehicle.transmission, null);
  assert.equal(report.vehicle.vinOrChassisMasked, null);
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes("undefined"), false);
  assert.equal(serialized.includes("NaN"), false);
});

test("access token authorizes matching calculation only", () => {
  const id = "clxxxxxxxxxxxxxxxxxxxx";
  const token = signDutyReportAccessToken(id, 60);
  assert.equal(verifyDutyReportAccessToken(token, id), true);
  assert.equal(verifyDutyReportAccessToken(token, "other-id"), false);
  assert.equal(verifyDutyReportAccessToken("bad.token", id), false);
});

test("PDF filename is sanitized", () => {
  assert.equal(dutyReportPdfFilename("DI-ABC/../../x"), "Spark-Drive-Duty-Estimate-DI-ABC-x.pdf");
});

test("empty line items yield empty unique list", () => {
  assert.deepEqual(uniqueDutyChargeLines(undefined), []);
  assert.deepEqual(uniqueDutyChargeLines(null as unknown as CalculationLineItem[]), []);
});
