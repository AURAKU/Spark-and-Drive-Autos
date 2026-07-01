import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeConfidence } from "@/lib/duty-intelligence/confidence";
import { runDutyFormulaEngine } from "@/lib/duty-intelligence/engines/duty-formula-engine";
import { extractFromDocumentText } from "@/lib/duty-intelligence/ocr";
import { resolveImportDutyRateForPowertrain } from "@/lib/duty/calculator";

describe("duty intelligence engine", () => {
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

  it("scores confidence from similar imports", () => {
    const low = computeConfidence([]);
    assert.equal(low.similarImportCount, 0);
    assert.equal(low.label, "LOW");

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
    );
    assert.ok(high.score >= 80);
    assert.equal(high.similarImportCount, 26);
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
