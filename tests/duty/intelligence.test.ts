import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildHistoricalComparison, computeConfidence } from "@/lib/duty-intelligence/confidence";
import { runDutyFormulaEngine } from "@/lib/duty-intelligence/engines/duty-formula-engine";
import { calculateInsuranceAmount } from "@/lib/duty-intelligence/engines/insurance-engine";
import { extractFromDocumentText } from "@/lib/duty-intelligence/ocr";
import { resolveImportDutyRateForPowertrain } from "@/lib/duty/calculator";
import { DUTY_INTELLIGENCE_FORMULA_VERSION } from "@/lib/duty-intelligence/formula-version";

describe("duty intelligence engine v3", () => {
  it("uses v4 formula version", () => {
    assert.equal(DUTY_INTELLIGENCE_FORMULA_VERSION, "sda-duty-intelligence-v4");
  });

  it("resolves ICE age bands for import duty", () => {
    const young = resolveImportDutyRateForPowertrain({
      powertrain: "GASOLINE_PETROL",
      vehicleAgeYears: 3,
      applyEvDutyWaiver: false,
    });
    assert.equal(young.rate, 0.32);

    const old = resolveImportDutyRateForPowertrain({
      powertrain: "GASOLINE_PETROL",
      vehicleAgeYears: 12,
      applyEvDutyWaiver: false,
    });
    assert.equal(old.rate, 0.18);
  });

  it("computes formula engine line items from configurable rules", () => {
    const lines = runDutyFormulaEngine({
      rules: [
        {
          id: "1",
          code: "IMPORT_DUTY",
          label: "Import Duty",
          basis: "CIF",
          rateType: "PERCENTAGE",
          rateValue: 0.32,
          conditionsJson: { powertrain: "GASOLINE_PETROL", ageBands: [{ maxYears: 5, rate: 0.32 }] },
          formulaNote: null,
          version: 1,
          sortOrder: 10,
        },
        {
          id: "2",
          code: "ECOWAS_LEVY",
          label: "ECOWAS",
          basis: "CIF",
          rateType: "PERCENTAGE",
          rateValue: 0.005,
          conditionsJson: null,
          formulaNote: null,
          version: 1,
          sortOrder: 20,
        },
        {
          id: "3",
          code: "VAT",
          label: "VAT",
          basis: "VAT_BASE",
          rateType: "PERCENTAGE",
          rateValue: 0.15,
          conditionsJson: null,
          formulaNote: null,
          version: 1,
          sortOrder: 40,
        },
      ],
      calibrationFactors: {},
      ctx: {
        cifGhs: 100_000,
        customsValueGhs: 100_000,
        importDutyGhs: 0,
        levySubtotalGhs: 0,
        vatBaseGhs: 0,
        vehicleAgeYears: 3,
        fuelType: "GASOLINE_PETROL",
        applyEvDutyWaiver: false,
        hsDutyRateHint: null,
      },
    });

    const duty = lines.find((l) => l.code === "IMPORT_DUTY");
    assert.ok(duty);
    assert.equal(duty!.amountGhs, 32_000);

    const vat = lines.find((l) => l.code === "VAT");
    assert.ok(vat);
    assert.ok(vat!.amountGhs > 0);
  });

  it("scores confidence with reasons from similar imports", () => {
    const low = computeConfidence([]);
    assert.equal(low.similarImportCount, 0);
    assert.equal(low.label, "LOW");
    assert.ok(low.reasons.length >= 2);

    const high = computeConfidence(
      Array.from({ length: 26 }, (_, i) => ({
        id: String(i),
        weight: 80,
        manufacturer: "Toyota",
        model: "RAV4",
        year: 2022,
        totalLandedCostGhs: 200_000,
        totalDutyGhs: 50_000,
        portChargesGhs: 5000,
        shippingLineGhs: 2000,
        agentFeesGhs: 3000,
      })),
      {
        countryCode: "GH",
        vehicle: {
          manufacturer: "Toyota",
          model: "RAV4",
          year: 2022,
          countryOfOrigin: "JAPAN",
          vehicleCategory: "SUV",
          fuelType: "GASOLINE_PETROL",
          engineCc: 2000,
          applyEvDutyWaiver: false,
        },
        purchase: { fobAmount: 18000, fobCurrency: "USD" },
        shipping: { shippingMethod: "SEA_FREIGHT", otherShippingChargesGhs: 0 },
      },
    );
    assert.ok(high.score >= 80);
    assert.equal(high.similarImportCount, 26);
    assert.ok(high.reasons.includes("Historical imports"));
  });

  it("builds historical comparison from similar imports", () => {
    const comparison = buildHistoricalComparison({
      estimatedDutyGhs: 95_420,
      similarImports: [
        { id: "1", weight: 80, manufacturer: "Jetour", model: "Dashing", year: 2022, totalDutyGhs: 95_100, totalLandedCostGhs: 200_000, portChargesGhs: 5000, shippingLineGhs: 2000, agentFeesGhs: 3000 },
        { id: "2", weight: 75, manufacturer: "Jetour", model: "Dashing", year: 2022, totalDutyGhs: 94_800, totalLandedCostGhs: 198_000, portChargesGhs: 4800, shippingLineGhs: 1900, agentFeesGhs: 2900 },
      ],
    });
    assert.ok(comparison);
    assert.equal(comparison!.similarImportCount, 2);
    assert.ok(comparison!.differencePct != null && comparison!.differencePct < 1);
  });

  it("calculates insurance from FOB + freight base", () => {
    const insuranceGhs = calculateInsuranceAmount({
      fobGhs: 200_000,
      freightGhs: 4800,
      percentageRate: 0.015,
    });
    assert.equal(insuranceGhs, 3072);
  });

  it("extracts VIN and HS code from document text", async () => {
    const extracted = await extractFromDocumentText(
      "Bill of Entry BOE-2024-12345 VIN 1HGBH41JXMN109186 HS 8703.23 Import Duty GHS 45,000",
    );
    assert.equal(extracted.vin, "1HGBH41JXMN109186");
    assert.ok(extracted.hsCode?.includes("8703"));
    assert.equal(extracted.billOfEntryNumber, "BOE-2024-12345");
  });
});

describe("duty config bootstrap helpers", () => {
  it("exports ensureCountryConfig loader", async () => {
    const { ensureCountryConfig } = await import("@/lib/duty-intelligence/config-loader");
    assert.equal(typeof ensureCountryConfig, "function");
  });
});

describe("duty calculation input validation", () => {
  it("rejects future year and zero FOB", async () => {
    const { dutyCalculationInputSchema } = await import("@/lib/duty-intelligence/types");
    const futureYear = new Date().getFullYear() + 2;
    const bad = dutyCalculationInputSchema.safeParse({
      countryCode: "GH",
      vehicle: {
        manufacturer: "Test",
        model: "Car",
        year: futureYear,
        countryOfOrigin: "CHINA",
        vehicleCategory: "SUV",
        fuelType: "GASOLINE_PETROL",
        engineCc: 2000,
        applyEvDutyWaiver: false,
      },
      purchase: { fobAmount: -100, fobCurrency: "USD" },
      shipping: { shippingMethod: "SEA_FREIGHT", otherShippingChargesGhs: 0 },
    });
    assert.equal(bad.success, false);
  });
});
