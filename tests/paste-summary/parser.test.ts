import assert from "node:assert/strict";
import test from "node:test";

import {
  parseCarSummaryForAutofill,
  parseCompatibleVehicleValue,
  parsePartSummaryForAutofill,
} from "@/lib/admin-summary-autofill";
import { adminAmountToCanonicalRmb } from "@/lib/currency";
import {
  clipTrailingClause,
  findBestMoneyInText,
  parseMoneyWithCurrency,
  parsePlainAmount,
  stripWeakTrailingPunctuation,
  tryParseLabelThenMoney,
  tryParseLabelValueLine,
  tryParseSpaceSeparatedLabelLine,
} from "@/lib/paste-summary/core";

const DEMO_FX = { usdToRmb: 7, rmbToGhs: 0.586, usdToGhs: 11.65 };

test("parsePlainAmount strips commas and stops at junk", () => {
  assert.equal(parsePlainAmount("95,000"), 95000);
  assert.equal(parsePlainAmount("45,000 km"), 45000);
  assert.equal(parsePlainAmount("2012"), 2012);
});

test("parseMoneyWithCurrency detects codes and symbols", () => {
  assert.deepEqual(parseMoneyWithCurrency("GHS 95,000"), { amount: 95000, currency: "GHS" });
  assert.deepEqual(parseMoneyWithCurrency("USD 12000"), { amount: 12000, currency: "USD" });
  assert.deepEqual(parseMoneyWithCurrency("CNY 65000"), { amount: 65000, currency: "CNY" });
  assert.deepEqual(parseMoneyWithCurrency("₵ 500"), { amount: 500, currency: "GHS" });
});

test("tryParseLabelValueLine supports colon, dash, no space after colon", () => {
  const a = tryParseLabelValueLine("year: 2012");
  assert.ok(a);
  assert.equal(a!.valueRaw, "2012");

  const b = tryParseLabelValueLine("Title - 2012 Toyota Corolla");
  assert.ok(b);
  assert.equal(b!.valueRaw, "2012 Toyota Corolla");

  const c = tryParseLabelValueLine("Year:2012");
  assert.ok(c);
  assert.equal(c!.valueRaw, "2012");

  const d = tryParseLabelValueLine("year: 2012.");
  assert.ok(d);
  assert.equal(d!.valueRaw, "2012.");
});

test("stripWeakTrailingPunctuation cleans sentence end only", () => {
  assert.equal(stripWeakTrailingPunctuation("2012."), "2012");
  assert.equal(stripWeakTrailingPunctuation("black,"), "black");
  assert.equal(stripWeakTrailingPunctuation("95,000"), "95,000");
});

test("tryParseSpaceSeparatedLabelLine matches longest label first", () => {
  const allowed = new Set(["title", "suppliercost", "year", "modelyear"]);
  const t = tryParseSpaceSeparatedLabelLine("title Toyota Corolla 2012", allowed, { maxLabelTokens: 2 });
  assert.ok(t);
  assert.equal(t!.normKey, "title");
  assert.equal(t!.valueRest, "Toyota Corolla 2012");

  const s = tryParseSpaceSeparatedLabelLine("supplier cost CNY 12000", allowed, { maxLabelTokens: 2 });
  assert.ok(s);
  assert.equal(s!.normKey, "suppliercost");
  assert.equal(s!.valueRest, "CNY 12000");
});

test("clipTrailingClause trims inline label after comma", () => {
  assert.equal(clipTrailingClause("foo, year: 2012"), "foo");
  assert.equal(clipTrailingClause("2012 Toyota Corolla"), "2012 Toyota Corolla");
});

test("tryParseLabelThenMoney reads label then currency amount", () => {
  const p = tryParseLabelThenMoney("price GHS 95000");
  assert.ok(p);
  assert.equal(p!.amount, 95000);
  assert.equal(p!.currency, "GHS");
});

test("findBestMoneyInText prefers price-tagged lines", () => {
  const m = findBestMoneyInText("notes\nasking USD 500\nrandom 999999");
  assert.ok(m);
  assert.equal(m!.currency, "USD");
  assert.equal(m!.amount, 500);
});

test("adminAmountToCanonicalRmb matches list-price pipeline", () => {
  assert.equal(adminAmountToCanonicalRmb(1000, "GHS", DEMO_FX), 586);
  assert.equal(adminAmountToCanonicalRmb(1000, "USD", DEMO_FX), 7000);
  assert.equal(adminAmountToCanonicalRmb(1000, "CNY", DEMO_FX), 1000);
});

test("parseCarSummaryForAutofill handles space-separated labels and trailing period on year", () => {
  const raw = ["title Toyota Corolla", "year 2012.", "fuel petrol"].join("\n");
  const r = parseCarSummaryForAutofill(raw);
  assert.equal(r.stringFields.title?.value, "Toyota Corolla");
  assert.equal(r.numberFields.year?.value, 2012);
  assert.ok(r.engineTypeEnum?.value);
});

test("parseCarSummaryForAutofill extracts multi-currency listing and supplier", () => {
  const raw = [
    "make: Toyota",
    "model: Corolla",
    "year: 2012",
    "mileage: 45,000 km",
    "base selling price: USD 12000",
    "supplier cost CNY 65000",
  ].join("\n");
  const r = parseCarSummaryForAutofill(raw);
  assert.equal(r.stringFields.brand?.value, "Toyota");
  assert.equal(r.stringFields.model?.value, "Corolla");
  assert.equal(r.numberFields.year?.value, 2012);
  assert.equal(r.numberFields.mileage?.value, 45000);
  assert.ok(r.listingPrice);
  assert.equal(r.listingPrice!.amount, 12000);
  assert.equal(r.listingPrice!.currency, "USD");
  assert.ok(r.supplierCost);
  assert.equal(r.supplierCost!.amount, 65000);
  assert.equal(r.supplierCost!.currency, "CNY");
});

test("parsePartSummaryForAutofill reads compatibility line and space-separated title", () => {
  const raw = ["title Bosch wiper blade", "compatibility Honda CRV 2017-2022"].join("\n");
  const r = parsePartSummaryForAutofill(raw);
  assert.equal(r.stringFields.title?.value, "Bosch wiper blade");
  assert.equal(r.stringFields.compatibleMake?.value, "Honda");
  assert.equal(r.stringFields.compatibleModel?.value, "CRV");
  assert.equal(r.stringFields.compatibleYearNote?.value, "2017-2022");
});

test("parsePartSummaryForAutofill separates part number, OEM, SKU, currencies, vehicle", () => {
  const raw = [
    "title: Honda CRV 2020 brake pads",
    "part number: BP-2020-CRV",
    "OEM: 45022-TLA-A00",
    "SKU: SHOP-991",
    "supplier cost: CNY 120",
    "selling price: GHS 350",
    "quantity: 12",
    "compatible vehicle: Honda CRV 2017-2022",
    "brand: Bosch",
  ].join("\n");
  const r = parsePartSummaryForAutofill(raw);
  assert.equal(r.stringFields.title?.value, "Honda CRV 2020 brake pads");
  assert.equal(r.stringFields.partNumber?.value, "BP-2020-CRV");
  assert.equal(r.stringFields.oemNumber?.value, "45022-TLA-A00");
  assert.equal(r.stringFields.sku?.value, "SHOP-991");
  assert.equal(r.stringFields.brand?.value, "Bosch");
  assert.equal(r.numberFields.stockQty?.value, 12);
  assert.equal(r.stringFields.compatibleMake?.value, "Honda");
  assert.equal(r.stringFields.compatibleModel?.value, "CRV");
  assert.equal(r.stringFields.compatibleYearNote?.value, "2017-2022");
  assert.ok(r.listPrice);
  assert.equal(r.listPrice!.currency, "GHS");
  assert.equal(r.listPrice!.amount, 350);
  assert.ok(r.supplierCost);
  assert.equal(r.supplierCost!.currency, "CNY");
  assert.equal(r.supplierCost!.amount, 120);
});

test("parseCompatibleVehicleValue handles year range only", () => {
  assert.deepEqual(parseCompatibleVehicleValue("2017-2022"), { compatibleYearNote: "2017-2022" });
});

test("year: 2012 maps to compatible year note only", () => {
  const r = parsePartSummaryForAutofill("year: 2012");
  assert.equal(r.stringFields.compatibleYearNote?.value, "2012");
});
