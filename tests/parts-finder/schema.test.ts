import assert from "node:assert/strict";
import test from "node:test";

import { buildExternalSearchQueries, normalizePartsQuery } from "@/lib/parts-finder/normalize-query";
import {
  describePartsFinderInputGap,
  looksLikeOemPartNumber,
  partsFinderInputSchema,
} from "@/lib/parts-finder/schemas";

test("OEM part numbers are recognized", () => {
  assert.equal(looksLikeOemPartNumber("45503-60050"), true);
  assert.equal(looksLikeOemPartNumber("455003-600500"), true);
  assert.equal(looksLikeOemPartNumber("58101-2S000 rack"), true);
  assert.equal(looksLikeOemPartNumber("front left control arm"), false);
  assert.equal(looksLikeOemPartNumber("ABC"), false);
});

test("schema accepts OEM-only searches", () => {
  const parsed = partsFinderInputSchema.parse({ partDescription: "45503-60050" });
  assert.equal(parsed.partDescription, "45503-60050");
  assert.equal(describePartsFinderInputGap({ partDescription: "45503-60050" }), null);
});

test("schema still requires vehicle context for prose-only parts", () => {
  const gap = describePartsFinderInputGap({ partDescription: "front left control arm" });
  assert.ok(gap);
  assert.throws(() => partsFinderInputSchema.parse({ partDescription: "front left control arm" }));
});

test("schema still accepts VIN or brand+model+year with a part", () => {
  assert.doesNotThrow(() =>
    partsFinderInputSchema.parse({ vin: "1HGCM82633A004352", partDescription: "brake pads" }),
  );
  assert.doesNotThrow(() =>
    partsFinderInputSchema.parse({
      brand: "Toyota",
      model: "Land Cruiser",
      year: "2018",
      partDescription: "front left control arm",
    }),
  );
});

test("OEM-only queries lead with the part number", () => {
  const normalized = normalizePartsQuery({ partDescription: "45503-60050" });
  const queries = buildExternalSearchQueries(normalized);
  assert.ok(queries.some((q) => q.includes("45503-60050") && q.toLowerCase().includes("oem")));
});
