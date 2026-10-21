import assert from "node:assert/strict";
import test from "node:test";

import {
  GRA_PLANNING_CHARGE_KEYS,
  applyCalculatorRateOverrides,
  defaultCalculatorRates,
  mergeCalculatorRates,
} from "@/lib/duty-intelligence/gra-planning-charges";
import { getRuleSetByProfileId } from "@/lib/duty-intelligence/rule-sets/verified-profiles";

const REQUIRED = [
  "IMPORT_DUTY",
  "IMPORT_VAT",
  "PROCESSING_FEE",
  "ECOWAS_LEVY",
  "VEHICLE_CERTIFICATION",
  "VEHICLE_EXAMINATION_FEE",
  "NETWORK_CHARGE",
  "NETWORK_CHARGE_VAT",
  "NETWORK_CHARGE_COVID",
  "GSA_SNF_FEE",
  "NHIL",
  "NETWORK_CHARGE_NHIL",
  "OVERAGE_PENALTY",
  "IRS_TAX_DEPOSIT",
  "DISINFECTION_FEE",
  "MOTI_EIDF_FEE",
  "SPECIAL_IMPORT_LEVY",
  "EXIM_LEVY",
  "GETFUND_LEVY",
  "NETWORK_CHARGE_GETFUND",
  "AU_LEVY",
  "COVID_HEALTH_RECOVERY_LEVY",
];

test("GRA planning catalog includes every official descriptor", () => {
  for (const key of REQUIRED) {
    assert.ok(GRA_PLANNING_CHARGE_KEYS.includes(key), `missing ${key}`);
  }
  assert.equal(defaultCalculatorRates().SPECIAL_IMPORT_LEVY?.rateValue, 0.02);
  assert.equal(defaultCalculatorRates().IMPORT_VAT?.rateValue, 0.15);
  assert.equal(defaultCalculatorRates().ECOWAS_LEVY?.rateValue, 0.005);
});

test("every live rule set exposes the official descriptor list", () => {
  for (const profileId of ["GH-HS-8703-GENERAL-V1", "GH-HS-870323-VERIFIED-V1", "GH-HS-870380-VERIFIED-V1"]) {
    const set = getRuleSetByProfileId(profileId);
    assert.ok(set);
    const keys = new Set(set!.rules.map((r) => r.chargeKey));
    for (const key of REQUIRED) {
      assert.ok(keys.has(key), `${profileId} missing ${key}`);
    }
  }
});

test("admin overlay replaces a percentage without dropping other lines", () => {
  const set = getRuleSetByProfileId("GH-HS-8703-GENERAL-V1");
  assert.ok(set);
  const next = applyCalculatorRateOverrides(set!.rules, {
    SPECIAL_IMPORT_LEVY: { rateType: "PERCENTAGE", rateValue: 0.01 },
  });
  assert.equal(next.find((r) => r.chargeKey === "SPECIAL_IMPORT_LEVY")?.rateValue, "0.01");
  assert.equal(next.find((r) => r.chargeKey === "IMPORT_VAT")?.rateValue, "0.15");
});

test("mergeCalculatorRates keeps defaults when stored JSON is partial", () => {
  const merged = mergeCalculatorRates({ IMPORT_VAT: { rateType: "PERCENTAGE", rateValue: 0.155 } });
  assert.equal(merged.IMPORT_VAT?.rateValue, 0.155);
  assert.equal(merged.EXIM_LEVY?.rateValue, 0.0075);
});
