import assert from "node:assert/strict";
import test from "node:test";

import { parsePublicStockFilter, publicStockLabel, stockFilterToOrigin } from "../../src/lib/part-stock-class";

test("maps stored origins to public stock labels", () => {
  assert.equal(publicStockLabel("GHANA"), "Ghana Stock");
  assert.equal(publicStockLabel("CHINA"), "Overseas Stock");
});

test("maps public stock filters and legacy china query", () => {
  assert.equal(parsePublicStockFilter("ghana"), "ghana");
  assert.equal(parsePublicStockFilter("overseas"), "overseas");
  assert.equal(parsePublicStockFilter("china"), "overseas");
  assert.equal(parsePublicStockFilter(undefined, "CHINA"), "overseas");
  assert.equal(parsePublicStockFilter("all", "GHANA"), "all");
  assert.equal(stockFilterToOrigin("overseas"), "CHINA");
  assert.equal(stockFilterToOrigin("ghana"), "GHANA");
  assert.equal(stockFilterToOrigin("all"), undefined);
});
