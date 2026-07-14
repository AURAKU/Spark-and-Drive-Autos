import assert from "node:assert/strict";
import test from "node:test";

import { CarListingState } from "@prisma/client";

import { motorcycleAdminWhere, parseMotorcycleAdminFilters } from "@/lib/motorcycles/filters";
import { motorcycleCreateSchema } from "@/lib/motorcycles/validation";

test("parseMotorcycleAdminFilters preserves filter state fields", () => {
  const f = parseMotorcycleAdminFilters({
    q: " Yamaha ",
    brand: "Yamaha",
    model: "MT",
    year: "2024",
    status: "AVAILABLE",
    location: "Ghana",
    fuel: "GASOLINE_PETROL",
    transmission: "6-speed",
    published: "published",
    page: "2",
  });
  assert.equal(f.q, "Yamaha");
  assert.equal(f.brand, "Yamaha");
  assert.equal(f.year, "2024");
  assert.equal(f.published, "published");
  assert.equal(f.page, 2);
});

test("motorcycleAdminWhere excludes soft-deleted by default", () => {
  const where = motorcycleAdminWhere(
    parseMotorcycleAdminFilters({ published: "", q: "", brand: "", model: "", year: "", status: "", location: "", fuel: "", transmission: "", page: "1" }),
  );
  assert.deepEqual(where, { AND: [{ deletedAt: null }] });
});

test("motorcycleAdminWhere published filter uses CarListingState", () => {
  const where = motorcycleAdminWhere(
    parseMotorcycleAdminFilters({ published: "published", page: "1" }),
  );
  const and = (where as { AND: unknown[] }).AND;
  assert.ok(and.some((c) => JSON.stringify(c).includes(CarListingState.PUBLISHED)));
});

test("motorcycleCreateSchema accepts enriched chassis fields", () => {
  const parsed = motorcycleCreateSchema.safeParse({
    brand: "Yamaha",
    model: "MT-07",
    year: 2024,
    basePriceAmount: 85000,
    basePriceCurrency: "GHS",
    engineType: "GASOLINE_PETROL",
    motorcycleType: "NAKED",
    mileage: 100,
    condition: "Used",
    sourceType: "IN_GHANA",
    longDescription: "A capable naked middleweight motorcycle for Accra streets.",
    cylinders: 2,
    gears: 6,
    absEquipped: "on",
    lengthMm: 2085,
    frontTyre: "120/70-17",
    rearTyre: "180/55-17",
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.cylinders, 2);
    assert.equal(parsed.data.absEquipped, true);
    assert.equal(parsed.data.frontTyre, "120/70-17");
  }
});

test("motorcycleCreateSchema rejects invented empty brand", () => {
  const parsed = motorcycleCreateSchema.safeParse({
    brand: "",
    model: "MT-07",
    year: 2024,
    basePriceAmount: 1,
    basePriceCurrency: "GHS",
    engineType: "GASOLINE_PETROL",
    motorcycleType: "NAKED",
    mileage: 0,
    condition: "Used",
    sourceType: "IN_GHANA",
    longDescription: "too short",
  });
  assert.equal(parsed.success, false);
});
