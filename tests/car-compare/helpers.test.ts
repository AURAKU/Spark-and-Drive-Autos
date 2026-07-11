import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCompareHrefFromEntries,
  buildComparePageHref,
  normalizeCompareSlugs,
  parseCompareCarsParam,
} from "@/lib/car-compare";

test("buildComparePageHref encodes slug pair", () => {
  assert.equal(buildComparePageHref(["slug-a", "slug-b"]), "/compare?cars=slug-a%2Cslug-b");
  assert.equal(buildComparePageHref(["slug-a", "slug-b"], 2), "/compare?cars=slug-a%2Cslug-b&page=2");
});

test("buildCompareHrefFromEntries requires exactly two entries", () => {
  assert.equal(buildCompareHrefFromEntries([]), null);
  assert.equal(
    buildCompareHrefFromEntries([
      {
        id: "1",
        slug: "a",
        title: "A",
        brand: "Brand",
        year: 2024,
        coverImageUrl: null,
      },
    ]),
    null,
  );
  assert.equal(
    buildCompareHrefFromEntries([
      {
        id: "1",
        slug: "a",
        title: "A",
        brand: "Brand",
        year: 2024,
        coverImageUrl: null,
      },
      {
        id: "2",
        slug: "b",
        title: "B",
        brand: "Brand",
        year: 2023,
        coverImageUrl: null,
      },
    ]),
    "/compare?cars=a%2Cb",
  );
});

test("parseCompareCarsParam and normalizeCompareSlugs", () => {
  assert.deepEqual(parseCompareCarsParam(" a , b "), ["a", "b"]);
  assert.deepEqual(normalizeCompareSlugs(["a", "b", "a"]), ["a", "b"]);
  assert.equal(normalizeCompareSlugs(["a"]), null);
});
