import { Suspense } from "react";
import { CarListingState } from "@prisma/client";
import { cookies } from "next/headers";
import Link from "next/link";

import { CarCompareAutoRedirect } from "@/components/cars/car-compare-auto-redirect";
import { CarCompareEmptyState } from "@/components/cars/car-compare-empty-state";
import { CarCompareView } from "@/components/cars/car-compare-view";
import { BrowseCarsCtaLink } from "@/components/storefront/storefront-cta-links";
import { PageHeading } from "@/components/typography/page-headings";
import {
  buildCarCompareRows,
  buildComparePageHref,
  CAR_COMPARE_SPEC_PAGE_SIZE,
  type CompareCarRecord,
  normalizeCompareSlugs,
  parseCompareCarsParam,
} from "@/lib/car-compare";
import { formatVehiclePriceFromRmb, getGlobalCurrencySettings, parseDisplayCurrency } from "@/lib/currency";
import { engineTypeLabel } from "@/lib/engine-type-ui";
import { normalizeIntelListPage } from "@/lib/ops";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstQueryValue(sp: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.find((x): x is string => typeof x === "string" && x.length > 0);
  return undefined;
}

function readPage(sp: Record<string, string | string[] | undefined>): number {
  const s = firstQueryValue(sp, "page");
  if (s == null || s === "") return 1;
  const n = parseInt(s, 10);
  return normalizeIntelListPage(Number.isFinite(n) ? n : undefined);
}

const compareCarSelect = {
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

export default async function CompareCarsPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const slugPair = normalizeCompareSlugs(parseCompareCarsParam(firstQueryValue(sp, "cars")));

  if (!slugPair) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <Suspense fallback={null}>
          <CarCompareAutoRedirect />
        </Suspense>
        <CarCompareEmptyState />
      </div>
    );
  }

  const [slugA, slugB] = slugPair;
  const pageReq = readPage(sp);

  const cookieStore = await cookies();
  const displayCurrency = parseDisplayCurrency(cookieStore.get("sda_currency")?.value);
  const fx = await getGlobalCurrencySettings();

  const cars = await prisma.car.findMany({
    where: {
      slug: { in: [slugA, slugB] },
      listingState: { in: [CarListingState.PUBLISHED, CarListingState.SOLD] },
    },
    select: compareCarSelect,
  });

  const left = cars.find((c) => c.slug === slugA);
  const right = cars.find((c) => c.slug === slugB);

  if (!left || !right) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <PageHeading variant="hero">Compare vehicles</PageHeading>
        <p className="mt-4 text-sm text-muted-foreground">
          One or both vehicles could not be found. They may have been removed or are not published.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <BrowseCarsCtaLink className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-5 text-sm font-semibold text-black hover:opacity-90" />
          <Link
            href="/compare"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-5 text-sm font-medium hover:bg-muted dark:border-white/15"
          >
            Start over
          </Link>
        </div>
      </div>
    );
  }

  const formatPrice = (car: CompareCarRecord) => {
    const rmb =
      typeof car.basePriceRmb === "number"
        ? car.basePriceRmb
        : Number(String(car.basePriceRmb ?? 0));
    return formatVehiclePriceFromRmb(Number.isFinite(rmb) ? rmb : 0, displayCurrency, fx);
  };
  const allRows = buildCarCompareRows(left, right, formatPrice, engineTypeLabel);
  const totalRows = allRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / CAR_COMPARE_SPEC_PAGE_SIZE));
  const page = Math.min(Math.max(1, pageReq), totalPages);
  const rows = allRows.slice((page - 1) * CAR_COMPARE_SPEC_PAGE_SIZE, page * CAR_COMPARE_SPEC_PAGE_SIZE);

  const pageHref = (nextPage: number) => buildComparePageHref([slugA, slugB], nextPage);
  const swapHref = buildComparePageHref([slugB, slugA], page);
  const prevHref = page > 1 ? pageHref(page - 1) : null;
  const nextHref = page < totalPages ? pageHref(page + 1) : null;
  const pageHrefs =
    totalPages > 1 ? Array.from({ length: totalPages }, (_, i) => pageHref(i + 1)) : undefined;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.25em] text-muted-foreground uppercase">Side by side</p>
          <PageHeading variant="hero" className="mt-2">
            Compare vehicles
          </PageHeading>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Review key specifications for both listings. Differences are highlighted so you can decide which vehicle fits
            best.
          </p>
        </div>
        <Link
          href="/inventory"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted dark:border-white/15"
        >
          Change selection
        </Link>
      </div>

      <CarCompareView
        left={{
          slug: left.slug,
          title: left.title,
          brand: left.brand,
          year: left.year,
          coverImageUrl: left.coverImageUrl,
          priceLabel: formatPrice(left),
        }}
        right={{
          slug: right.slug,
          title: right.title,
          brand: right.brand,
          year: right.year,
          coverImageUrl: right.coverImageUrl,
          priceLabel: formatPrice(right),
        }}
        rows={rows}
        page={page}
        totalPages={totalPages}
        totalRows={totalRows}
        pageSize={CAR_COMPARE_SPEC_PAGE_SIZE}
        prevHref={prevHref}
        nextHref={nextHref}
        pageHrefs={pageHrefs}
        swapHref={swapHref}
      />
    </div>
  );
}
