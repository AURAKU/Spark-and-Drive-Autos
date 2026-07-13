import { Suspense } from "react";
import { cookies } from "next/headers";
import Link from "next/link";

import { CarCompareAutoRedirect } from "@/components/cars/car-compare-auto-redirect";
import { CarCompareEmptyState } from "@/components/cars/car-compare-empty-state";
import { CarCompareView } from "@/components/cars/car-compare-view";
import { BrowseCarsCtaLink } from "@/components/storefront/storefront-cta-links";
import { PageHeading } from "@/components/typography/page-headings";
import { resolveCompareCarsQuery } from "@/lib/car-compare";
import { parseDisplayCurrency } from "@/lib/currency";
import { normalizeIntelListPage } from "@/lib/ops";
import { buildComparePagePayload } from "@/lib/vehicles/comparison.server";

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

function CompareNotice({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <PageHeading variant="hero">{title}</PageHeading>
      <p className="mt-4 text-sm text-muted-foreground">{body}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <BrowseCarsCtaLink className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-5 text-sm font-semibold text-black hover:opacity-90" />
        <Link
          href="/compare"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-5 text-sm font-medium hover:bg-muted dark:border-white/15"
        >
          Start over
        </Link>
        <Link
          href="/inventory"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-5 text-sm font-medium hover:bg-muted dark:border-white/15"
        >
          Back to inventory
        </Link>
      </div>
    </div>
  );
}

export default async function CompareCarsPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const resolved = resolveCompareCarsQuery(firstQueryValue(sp, "cars"));

  if (resolved.status === "empty") {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <Suspense fallback={null}>
          <CarCompareAutoRedirect />
        </Suspense>
        <CarCompareEmptyState />
      </div>
    );
  }

  if (resolved.status === "one") {
    return (
      <CompareNotice
        title="Select one more vehicle"
        body={`You selected “${resolved.slug}”. Choose a second distinct vehicle from inventory to open the side-by-side comparison.`}
      />
    );
  }

  if (resolved.status === "duplicate") {
    return (
      <CompareNotice
        title="Choose two different vehicles"
        body="The same vehicle was selected twice. Pick two distinct listings to compare."
      />
    );
  }

  if (resolved.status === "invalid") {
    return (
      <CompareNotice
        title="Invalid comparison link"
        body="That comparison URL is malformed or contains unsupported characters. Start again from inventory and select two vehicles."
      />
    );
  }

  const [slugA, slugB] = resolved.slugs;
  const pageReq = readPage(sp);

  const cookieStore = await cookies();
  const displayCurrency = parseDisplayCurrency(cookieStore.get("sda_currency")?.value);

  const payload = await buildComparePagePayload(slugA, slugB, { displayCurrency, pageReq });

  if (payload.status === "db_error") {
    return (
      <CompareNotice
        title="Comparison temporarily unavailable"
        body="We could not load vehicle data right now. Please try again in a moment."
      />
    );
  }

  if (payload.status === "missing") {
    return (
      <CompareNotice
        title="One selected vehicle is no longer available"
        body={
          payload.missingSlugs.length >= 2
            ? "Both selected vehicles could not be found. They may have been removed or are not published."
            : `“${payload.missingSlugs[0] ?? "A selected vehicle"}” is no longer available. Update your selection and try again.`
        }
      />
    );
  }

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
        left={payload.left}
        right={payload.right}
        rows={payload.rows}
        page={payload.page}
        totalPages={payload.totalPages}
        totalRows={payload.totalRows}
        pageSize={payload.pageSize}
        prevHref={payload.prevHref}
        nextHref={payload.nextHref}
        pageHrefs={payload.pageHrefs}
        swapHref={payload.swapHref}
      />
    </div>
  );
}
