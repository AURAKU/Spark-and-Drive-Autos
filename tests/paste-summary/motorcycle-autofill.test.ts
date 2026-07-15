import assert from "node:assert/strict";
import test from "node:test";

import {
  parseMotorcycleSummaryForAutofill,
  previewRowsFromMotorcycleParse,
} from "@/lib/motorcycle-summary-autofill";
import { parseSpecificationsText } from "@/lib/motorcycle-spec-parser";
import { groupPublicSpecs, resolveMotorcycleSpecRows, specsToPlainText } from "@/lib/motorcycle-specs";

test("parseMotorcycleSummaryForAutofill reads labeled motorcycle fields only", () => {
  const raw = `
Make: Yamaha
Model: MT-07
Year: 2024
Engine CC: 689
Price GHS 85000
Mileage: 1200 km
Fuel type: Petrol
Torque: 68 Nm
Transmission: 6-speed
Weight: 184 kg
Tyres: 120/70-17 · 180/55-17
Brakes: Dual disc ABS
Suspension: KYB inverted forks
Location: Accra
Motorcycle type: Naked
Features: ABS, Traction Control
`;
  const parsed = parseMotorcycleSummaryForAutofill(raw);
  assert.equal(parsed.stringFields.brand?.value, "Yamaha");
  assert.equal(parsed.stringFields.model?.value, "MT-07");
  assert.equal(parsed.numberFields.year?.value, 2024);
  assert.equal(parsed.numberFields.engineCc?.value, 689);
  assert.equal(parsed.numberFields.mileage?.value, 1200);
  assert.equal(parsed.stringFields.torque?.value, "68 Nm");
  assert.equal(parsed.stringFields.transmission?.value, "6-speed");
  assert.equal(parsed.numberFields.weightKg?.value, 184);
  assert.equal(parsed.stringFields.tyreSize?.value, "120/70-17 · 180/55-17");
  assert.equal(parsed.stringFields.location?.value, "Accra");
  assert.ok(parsed.listingPrice);
  assert.equal(parsed.listingPrice?.amount, 85000);
  assert.equal(parsed.listingPrice?.currency, "GHS");
  assert.equal(parsed.motorcycleTypeEnum?.value, "NAKED");
  assert.ok(parsed.specLines.some((s) => s.label === "Brakes" && s.value.includes("ABS")));
  assert.ok(parsed.specLines.some((s) => s.label === "Suspension"));
  // Never invent absent fields
  assert.equal(parsed.numberFields.horsepower, undefined);
  assert.equal(parsed.stringFields.vin, undefined);
});

test("parseMotorcycleSummaryForAutofill does not invent values from thin free text", () => {
  const parsed = parseMotorcycleSummaryForAutofill("looking for a bike soon");
  assert.equal(Object.keys(parsed.stringFields).length, 0);
  assert.equal(parsed.listingPrice, undefined);
  assert.equal(parsed.numberFields.year, undefined);
});

test("previewRowsFromMotorcycleParse surfaces detected rows", () => {
  const parsed = parseMotorcycleSummaryForAutofill("Make: Honda\nModel: PCX\nYear: 2022\nEngine CC: 157");
  const rows = previewRowsFromMotorcycleParse(parsed);
  assert.ok(rows.some((r) => r.field === "Make" && r.value === "Honda"));
  assert.ok(rows.some((r) => r.field === "Engine (cc)" && r.value === "157"));
});

test("parseSpecificationsText supports groups and units", () => {
  const rows = parseSpecificationsText(`[Engine]\nDisplacement: 689 cc\n[Brakes] Front: Dual disc`);
  assert.equal(rows[0]?.groupName, "Engine");
  assert.equal(rows[0]?.label, "Displacement");
  assert.equal(rows[0]?.value, "689");
  assert.equal(rows[0]?.unit?.toLowerCase(), "cc");
  assert.equal(rows[1]?.groupName, "Brakes");
  assert.equal(rows[1]?.label, "Front");
});

test("resolveMotorcycleSpecRows prefers JSON over plain text", () => {
  const rows = resolveMotorcycleSpecRows({
    specificationsJson: JSON.stringify([
      { label: "Power", value: "55", unit: "kW", groupName: "Performance", isPublic: false, sortOrder: 0 },
    ]),
    specificationsText: "Ignored: yes",
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.label, "Power");
  assert.equal(rows[0]?.isPublic, false);
  assert.equal(rows[0]?.unit, "kW");
});

test("groupPublicSpecs hides internal rows and groups by name", () => {
  const groups = groupPublicSpecs([
    { id: "1", groupName: "Engine", label: "CC", value: "689", isPublic: true },
    { id: "2", groupName: "Engine", label: "Dealer code", value: "X", isPublic: false },
    { id: "3", groupName: null, label: "Color", value: "Blue", isPublic: true },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.group, "Engine");
  assert.equal(groups[0]?.items.length, 1);
  assert.equal(groups[1]?.group, null);
});

test("specsToPlainText is deterministic", () => {
  const text = specsToPlainText([
    { label: "Power", value: "54", unit: "hp", groupName: "Performance", sortOrder: 0, isPublic: true },
  ]);
  assert.equal(text, "[Performance] Power: 54 hp");
});
