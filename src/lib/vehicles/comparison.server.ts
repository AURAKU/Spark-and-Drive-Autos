import "server-only";

import { CarListingState } from "@prisma/client";

import {
  buildCarCompareRows,
  buildComparePageHref,
  CAR_COMPARE_SPEC_PAGE_SIZE,
  type CarCompareRow,
  type CompareCarRecord,
  type CompareCarSummary,
  safeCoverImageUrl,
} from "@/lib/car-compare";
import {
  type DisplayCurrency,
  formatVehiclePriceFromRmb,
  getGlobalCurrencySettings,
  type FxRatesInput,
} from "@/lib/currency";
import { engineTypeLabel } from "@/lib/engine-type-ui";
import { prisma } from "@/lib/prisma";

const COMPARE_CAR_SELECT = {
  slug: true,
  title: true,
  brand: true,
  model: true,
  year: true,
  trim: true,
  bodyType: true,
  engineType: true,
  transmission: true,
  drivetrain: true,
  mileage: true,
  colorExterior: true,
  colorInterior: true,
  vin: true,
  condition: true,
  inspectionStatus: true,
  estimatedDelivery: true,
  seaShippingFeeGhs: true,
  sourceType: true,
  location: true,
  shortDescription: true,
  coverImageUrl: true,
  basePriceRmb: true,
  specifications: true,
  specs: { orderBy: { sortOrder: "asc" as const }, select: { label: true, value: true } },
} as const;

export type CompareFetchResult =
  | { status: "ok"; left: CompareCarRecord; right: CompareCarRecord }
  | { status: "missing"; foundSlugs: string[]; missingSlugs: string[] }
  | { status: "db_error"; message: string };

function toPlainNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "object" && value !== null && "toString" in value) {
    const n = Number(String(value));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeDbCar(car: {
  slug: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  trim: string | null;
  bodyType: string | null;
  engineType: CompareCarRecord["engineType"];
  transmission: string | null;
  drivetrain: string | null;
  mileage: number | null;
  colorExterior: string | null;
  colorInterior: string | null;
  vin: string | null;
  condition: string | null;
  inspectionStatus: string | null;
  estimatedDelivery: string | null;
  seaShippingFeeGhs: unknown;
  sourceType: CompareCarRecord["sourceType"];
  location: string | null;
  shortDescription: string | null;
  coverImageUrl: string | null;
  basePriceRmb: unknown;
  specifications: unknown;
  specs: Array<{ label: string; value: string }>;
}): CompareCarRecord {
  return {
    slug: car.slug,
    title: car.title,
    brand: car.brand,
    model: car.model,
    year: car.year,
    trim: car.trim,
    bodyType: car.bodyType,
    engineType: car.engineType,
    transmission: car.transmission,
    drivetrain: car.drivetrain,
    mileage: typeof car.mileage === "number" && Number.isFinite(car.mileage) ? car.mileage : null,
    colorExterior: car.colorExterior,
    colorInterior: car.colorInterior,
    vin: car.vin,
    condition: car.condition,
    inspectionStatus: car.inspectionStatus,
    estimatedDelivery: car.estimatedDelivery,
    seaShippingFeeGhs: toPlainNumber(car.seaShippingFeeGhs),
    sourceType: car.sourceType,
    location: car.location,
    shortDescription: car.shortDescription,
    coverImageUrl: safeCoverImageUrl(car.coverImageUrl),
    basePriceRmb: toPlainNumber(car.basePriceRmb) ?? 0,
    specifications: car.specifications ?? null,
    specs: Array.isArray(car.specs)
      ? car.specs
          .filter((s) => s && typeof s.label === "string" && typeof s.value === "string")
          .map((s) => ({ label: s.label, value: s.value }))
      : [],
  };
}

/** Format list price for comparison — never returns NaN/undefined. */
export function formatComparePriceLabel(
  car: CompareCarRecord,
  displayCurrency: DisplayCurrency,
  fx: FxRatesInput,
): string {
  const rmb = toPlainNumber(car.basePriceRmb);
  if (rmb == null || rmb <= 0) return "Contact for price";
  try {
    const label = formatVehiclePriceFromRmb(rmb, displayCurrency, fx);
    if (!label || label.includes("NaN")) return "Contact for price";
    return label;
  } catch {
    return "Contact for price";
  }
}

export async function fetchCompareCarsBySlugs(
  slugA: string,
  slugB: string,
): Promise<CompareFetchResult> {
  try {
    const cars = await prisma.car.findMany({
      where: {
        slug: { in: [slugA, slugB] },
        listingState: { in: [CarListingState.PUBLISHED, CarListingState.SOLD] },
      },
      select: COMPARE_CAR_SELECT,
    });

    const bySlug = new Map(cars.map((c) => [c.slug, c]));
    const leftRaw = bySlug.get(slugA);
    const rightRaw = bySlug.get(slugB);

    if (!leftRaw || !rightRaw) {
      const foundSlugs = cars.map((c) => c.slug);
      const missingSlugs = [slugA, slugB].filter((s) => !bySlug.has(s));
      return { status: "missing", foundSlugs, missingSlugs };
    }

    return {
      status: "ok",
      left: normalizeDbCar(leftRaw),
      right: normalizeDbCar(rightRaw),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database unavailable";
    console.error("[compare] fetchCompareCarsBySlugs failed", message);
    return { status: "db_error", message: "Database temporarily unavailable" };
  }
}

export type ComparePagePayload = {
  left: CompareCarSummary;
  right: CompareCarSummary;
  rows: CarCompareRow[];
  page: number;
  totalPages: number;
  totalRows: number;
  pageSize: number;
  prevHref: string | null;
  nextHref: string | null;
  pageHrefs: string[] | undefined;
  swapHref: string;
};

export async function buildComparePagePayload(
  slugA: string,
  slugB: string,
  options: {
    displayCurrency: DisplayCurrency;
    pageReq: number;
  },
): Promise<
  | ({ status: "ok" } & ComparePagePayload)
  | { status: "missing"; foundSlugs: string[]; missingSlugs: string[] }
  | { status: "db_error"; message: string }
> {
  const fx = await getGlobalCurrencySettings();
  const fetched = await fetchCompareCarsBySlugs(slugA, slugB);
  if (fetched.status !== "ok") return fetched;

  const formatPrice = (car: CompareCarRecord) =>
    formatComparePriceLabel(car, options.displayCurrency, fx);

  const allRows = buildCarCompareRows(fetched.left, fetched.right, formatPrice, engineTypeLabel);
  const totalRows = allRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / CAR_COMPARE_SPEC_PAGE_SIZE));
  const page = Math.min(Math.max(1, options.pageReq), totalPages);
  const rows = allRows.slice(
    (page - 1) * CAR_COMPARE_SPEC_PAGE_SIZE,
    page * CAR_COMPARE_SPEC_PAGE_SIZE,
  );

  const pageHref = (nextPage: number) => buildComparePageHref([slugA, slugB], nextPage);
  const swapHref = buildComparePageHref([slugB, slugA], page);
  const prevHref = page > 1 ? pageHref(page - 1) : null;
  const nextHref = page < totalPages ? pageHref(page + 1) : null;
  const pageHrefs =
    totalPages > 1 ? Array.from({ length: totalPages }, (_, i) => pageHref(i + 1)) : undefined;

  return {
    status: "ok",
    left: {
      slug: fetched.left.slug,
      title: fetched.left.title,
      brand: fetched.left.brand,
      year: fetched.left.year,
      coverImageUrl: fetched.left.coverImageUrl,
      priceLabel: formatPrice(fetched.left),
    },
    right: {
      slug: fetched.right.slug,
      title: fetched.right.title,
      brand: fetched.right.brand,
      year: fetched.right.year,
      coverImageUrl: fetched.right.coverImageUrl,
      priceLabel: formatPrice(fetched.right),
    },
    rows,
    page,
    totalPages,
    totalRows,
    pageSize: CAR_COMPARE_SPEC_PAGE_SIZE,
    prevHref,
    nextHref,
    pageHrefs,
    swapHref,
  };
}
