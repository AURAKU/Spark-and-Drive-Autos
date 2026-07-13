import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCompareClientPayloadSerializable,
  buildCarCompareRows,
  buildCompareHrefFromEntries,
  buildComparePageHref,
  COMPARE_NOT_PROVIDED,
  decimalToNumber,
  normalizeCompareSlugs,
  parseCompareCarsParam,
  resolveCompareCarsQuery,
  safeCoverImageUrl,
  type CompareCarRecord,
} from "@/lib/car-compare";

function fixtureCar(overrides: Partial<CompareCarRecord> = {}): CompareCarRecord {
  return {
    slug: "car-a",
    title: "Car A",
    brand: "Toyota",
    model: "RAV4",
    year: 2024,
    trim: null,
    bodyType: "SUV",
    engineType: "GASOLINE_PETROL",
    transmission: "Automatic",
    drivetrain: "2WD",
    mileage: 12000,
    colorExterior: "White",
    colorInterior: null,
    vin: null,
    condition: "Used",
    inspectionStatus: null,
    estimatedDelivery: null,
    seaShippingFeeGhs: null,
    sourceType: "IN_CHINA",
    location: "Guangzhou",
    shortDescription: null,
    coverImageUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    basePriceRmb: 120000,
    specs: [],
    specifications: null,
    ...overrides,
  };
}

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

test("resolveCompareCarsQuery: empty / one / duplicate / invalid / pair", () => {
  assert.equal(resolveCompareCarsQuery(undefined).status, "empty");
  assert.equal(resolveCompareCarsQuery("").status, "empty");
  assert.deepEqual(resolveCompareCarsQuery("only-one"), { status: "one", slug: "only-one" });
  assert.deepEqual(resolveCompareCarsQuery("same,same"), { status: "duplicate", slug: "same" });
  assert.equal(resolveCompareCarsQuery("bad slug!").status, "invalid");
  assert.equal(resolveCompareCarsQuery("../evil").status, "invalid");
  assert.deepEqual(resolveCompareCarsQuery("a,b"), { status: "pair", slugs: ["a", "b"] });
  assert.deepEqual(resolveCompareCarsQuery("a,b,c"), { status: "pair", slugs: ["a", "b"] });
  assert.deepEqual(resolveCompareCarsQuery("a,b,a"), { status: "pair", slugs: ["a", "b"] });
});

test("resolveCompareCarsQuery handles encoded commas", () => {
  assert.deepEqual(resolveCompareCarsQuery("slug-a%2Cslug-b"), {
    status: "pair",
    slugs: ["slug-a", "slug-b"],
  });
});

test("safeCoverImageUrl rejects empty and junk", () => {
  assert.equal(safeCoverImageUrl(null), null);
  assert.equal(safeCoverImageUrl("   "), null);
  assert.equal(safeCoverImageUrl("null"), null);
  assert.equal(safeCoverImageUrl(" https://x.test/a.jpg "), "https://x.test/a.jpg");
});

test("decimalToNumber handles Decimal-like, string, null", () => {
  assert.equal(decimalToNumber(null), 0);
  assert.equal(decimalToNumber("12.5"), 12.5);
  assert.equal(decimalToNumber({ toString: () => "99.1" }), 99.1);
  assert.equal(decimalToNumber(Number.NaN), 0);
});

test("buildCarCompareRows hides both-missing optional rows and uses Not provided", () => {
  const left = fixtureCar({
    colorInterior: "Black",
    trim: null,
    estimatedDelivery: null,
    shortDescription: null,
    specs: [],
    specifications: null,
  });
  const right = fixtureCar({
    slug: "car-b",
    title: "Car B",
    model: "Camry",
    colorInterior: null,
    trim: null,
    estimatedDelivery: null,
    shortDescription: null,
    specs: [],
    specifications: null,
  });

  const rows = buildCarCompareRows(
    left,
    right,
    () => "GHS 100",
    (engine) => String(engine),
  );

  const trim = rows.find((r) => r.key === "trim");
  assert.equal(trim, undefined, "both-missing trim should be hidden");

  const interior = rows.find((r) => r.key === "interior");
  assert.ok(interior);
  assert.equal(interior!.left, "Black");
  assert.equal(interior!.right, COMPARE_NOT_PROVIDED);

  const price = rows.find((r) => r.key === "price");
  assert.ok(price);
  assert.equal(price!.left, "GHS 100");
});

test("buildCarCompareRows supports EV vs petrol and JSON specs", () => {
  const ev = fixtureCar({
    slug: "ev",
    engineType: "ELECTRIC",
    transmission: null,
    specifications: { "EV range": "420 km", Power: "150 kW" },
    basePriceRmb: { toString: () => "180000" },
    coverImageUrl: null,
  });
  const petrol = fixtureCar({
    slug: "petrol",
    engineType: "GASOLINE_PETROL",
    specifications: [{ label: "Power", value: "120 kW" }],
    specs: [{ label: "Seating", value: "5" }],
  });

  const rows = buildCarCompareRows(
    ev,
    petrol,
    (car) => `RMB ${decimalToNumber(car.basePriceRmb)}`,
    (engine) => (engine === "ELECTRIC" ? "Electric (BEV)" : "Gasoline"),
  );

  const engine = rows.find((r) => r.key === "engine");
  assert.ok(engine);
  assert.equal(engine!.left, "Electric (BEV)");
  assert.equal(engine!.right, "Gasoline");
  assert.equal(engine!.differs, true);

  const range = rows.find((r) => r.key === "highlight:EV range");
  assert.ok(range);
  assert.equal(range!.left, "420 km");
  assert.equal(range!.right, COMPARE_NOT_PROVIDED);

  const seating = rows.find((r) => r.key === "spec:Seating");
  assert.ok(seating);
  assert.equal(seating!.left, COMPARE_NOT_PROVIDED);
  assert.equal(seating!.right, "5");
});

test("buildCarCompareRows survives null specs arrays and missing price formatting", () => {
  const left = fixtureCar({
    specs: undefined as unknown as CompareCarRecord["specs"],
    specifications: "not-json",
    basePriceRmb: 0,
    mileage: null,
  });
  const right = fixtureCar({
    slug: "b",
    specs: null as unknown as CompareCarRecord["specs"],
    specifications: {},
    coverImageUrl: "",
  });

  const rows = buildCarCompareRows(
    left,
    right,
    (car) => (decimalToNumber(car.basePriceRmb) > 0 ? "priced" : "Contact for price"),
    () => "—",
  );

  assert.ok(rows.some((r) => r.key === "price" && r.left === "Contact for price"));
  assert.ok(rows.some((r) => r.key === "year"));
});

test("client payload must be JSON serializable (no functions)", () => {
  const payload = {
    left: {
      slug: "a",
      title: "A",
      brand: "B",
      year: 2020,
      coverImageUrl: null,
      priceLabel: "Contact for price",
    },
    right: {
      slug: "b",
      title: "C",
      brand: "D",
      year: 2021,
      coverImageUrl: "https://example.com/x.jpg",
      priceLabel: "GHS 1",
    },
    rows: [{ key: "price", label: "List price", left: "1", right: "2", differs: true }],
    page: 1,
    totalPages: 1,
    totalRows: 1,
    pageSize: 12,
    prevHref: null,
    nextHref: null,
    pageHrefs: undefined,
    swapHref: "/compare?cars=b%2Ca",
  };
  assert.doesNotThrow(() => assertCompareClientPayloadSerializable(payload));
  assert.throws(() =>
    assertCompareClientPayloadSerializable({
      ...payload,
      pageHref: (n: number) => String(n),
    }),
  );
});

test("selection limit of two is enforced by helpers", () => {
  assert.equal(buildCompareHrefFromEntries([]), null);
  assert.equal(
    buildCompareHrefFromEntries([
      { id: "1", slug: "a", title: "A", brand: "B", year: 1, coverImageUrl: null },
      { id: "2", slug: "b", title: "B", brand: "B", year: 2, coverImageUrl: null },
      { id: "3", slug: "c", title: "C", brand: "B", year: 3, coverImageUrl: null },
    ] as never),
    // helper only checks length === 2; extra ignored by type callers via storage slice
    null,
  );
});
