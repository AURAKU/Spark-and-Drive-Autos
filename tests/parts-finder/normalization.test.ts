import assert from "node:assert/strict";
import test from "node:test";

import { normalizePartsQuery } from "@/lib/parts-finder/normalize-query";

test("normalization extracts qualifiers and symptoms", () => {
  const normalized = normalizePartsQuery({
    brand: "Toyota",
    model: "Corolla",
    year: "2018",
    engine: "1.8",
    partDescription: "front left control arm causing noise and vibration",
  });

  assert.equal(normalized.partIntentCanonical, "control_arm");
  assert.ok(normalized.qualifiers.includes("FRONT"));
  assert.ok(normalized.qualifiers.includes("LEFT"));
  assert.ok(normalized.symptoms.includes("NOISE"));
  assert.ok(normalized.symptoms.includes("VIBRATION"));
  assert.ok(normalized.expandedIntentTerms.length > 0);
});

test("normalization supports symptom-style overheating input", () => {
  const normalized = normalizePartsQuery({
    brand: "Honda",
    model: "Civic",
    year: 2015,
    partDescription: "engine overheating leak near radiator",
  });

  assert.ok(normalized.symptoms.includes("OVERHEATING"));
  assert.ok(normalized.symptoms.includes("LEAK"));
});
