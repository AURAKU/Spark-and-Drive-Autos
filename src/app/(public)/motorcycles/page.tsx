import { AvailabilityStatus, CarListingState, type Prisma, SourceType } from "@prisma/client";
import { cookies } from "next/headers";
import Link from "next/link";

import { MotorcycleCard } from "@/components/motorcycles/motorcycle-card";
import { SharePageButton } from "@/components/sharing/share-page-button";
import { PageHeading } from "@/components/typography/page-headings";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { globalReservationDepositPercentFromSettings } from "@/lib/checkout-amount";
import { getCarCheckoutIneligibleReason } from "@/lib/checkout-eligibility";
import { getCarDisplayPrice, getGlobalCurrencySettings, parseDisplayCurrency } from "@/lib/currency";
import { computeDepositCheckoutSnapshot } from "@/lib/vehicle-deposit-pricing";
import { normalizeIntelListPage } from "@/lib/ops";
import { getPublicAppUrl } from "@/lib/app-url";
import { resolveCarVideoPosterUrl } from "@/lib/car-video-poster";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const PAGE_SIZE = 12;
const BROWSE_SOURCE_TYPES: SourceType[] = [SourceType.IN_GHANA, SourceType.IN_CHINA];

const include = {
  videos: {
    orderBy: [{ isFeatured: "desc" as const }, { sortOrder: "asc" as const }],
    take: 1,
    select: { thumbnailUrl: true, url: true, publicId: true },
  },
  images: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { url: true } },
} satisfies Prisma.MotorcycleInclude;

function firstQueryValue(sp: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.find((x): x is string => typeof x === "string" && x.length > 0);
  return undefined;
}

function readPage(sp: Record<string, string | string[] | undefined>): number {
  const n = parseInt(firstQueryValue(sp, "page") ?? "1", 10);
  return normalizeIntelListPage(Number.isFinite(n) ? n : undefined);
}

export const metadata = {
  title: "Browse Motorcycles & E-Bikes | Spark and Drive Autos",
  description: "Gasoline, electric motorcycles, scooters, and e-bikes — browse inventory with shipping and duty estimates.",
};

export default async function MotorcyclesBrowsePage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const q = (firstQueryValue(sp, "q") ?? "").trim();
  const brand = (firstQueryValue(sp, "brand") ?? "").trim();
  const category = (firstQueryValue(sp, "category") ?? "").trim();
  const fuel = (firstQueryValue(sp, "fuel") ?? "").trim();
  const rawSource = (firstQueryValue(sp, "source") ?? "").trim().toUpperCase();
  const source = rawSource === "IN_GHANA" || rawSource === "IN_CHINA" ? rawSource : "";
  const pageReq = readPage(sp);

  const cookieStore = await cookies();
  const displayCurrency = parseDisplayCurrency(cookieStore.get("sda_currency")?.value);
  const fx = await getGlobalCurrencySettings();
  const globalDepositPct = globalReservationDepositPercentFromSettings(fx);

  const andClauses: Prisma.MotorcycleWhereInput[] = [
    { sourceType: { in: BROWSE_SOURCE_TYPES } },
    { availabilityStatus: { not: AvailabilityStatus.IN_TRANSIT_STOCK } },
    { listingState: { in: [CarListingState.PUBLISHED, CarListingState.SOLD] } },
  ];

  if (q) {
    andClauses.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { model: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (brand) andClauses.push({ brand: { equals: brand, mode: "insensitive" } });
  if (category) andClauses.push({ motorcycleType: category as never });
  if (fuel === "ELECTRIC") andClauses.push({ engineType: "ELECTRIC" });
  if (fuel === "GASOLINE") andClauses.push({ engineType: { in: ["GASOLINE_PETROL", "GASOLINE_DIESEL"] } });
  if (source) andClauses.push({ sourceType: source as SourceType });

  const where: Prisma.MotorcycleWhereInput = { AND: andClauses };
  const total = await prisma.motorcycle.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, pageReq), totalPages);

  const motorcycles = await prisma.motorcycle.findMany({
    where,
    include,
    orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const featured = await prisma.motorcycle.findMany({
    where: { ...where, featured: true },
    include,
    take: 4,
    orderBy: { updatedAt: "desc" },
  });

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (brand) params.set("brand", brand);
    if (category) params.set("category", category);
    if (fuel) params.set("fuel", fuel);
    if (source) params.set("source", source);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/motorcycles?${qs}` : "/motorcycles";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <PageHeading variant="hero">Motorcycles & E-Bikes</PageHeading>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Sport bikes, scooters, electric motorcycles, and e-bicycles — with automatic shipping and duty estimates.
          </p>
        </div>
        <SharePageButton url={`${getPublicAppUrl()}/motorcycles`} title="Spark & Drive Motorcycles" />
      </div>

      <form className="mt-6 flex flex-wrap gap-2" action="/motorcycles" method="get">
        <input name="q" defaultValue={q} placeholder="Search brand or model…" className="rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-white/15 dark:bg-black/40" />
        <select name="source" defaultValue={source} className="rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-white/15 dark:bg-black/40">
          <option value="">All locations</option>
          <option value="IN_GHANA">Ghana</option>
          <option value="IN_CHINA">China</option>
        </select>
        <select name="fuel" defaultValue={fuel} className="rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-white/15 dark:bg-black/40">
          <option value="">All fuel types</option>
          <option value="GASOLINE">Petrol / Diesel</option>
          <option value="ELECTRIC">Electric</option>
        </select>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Filter</button>
      </form>

      {featured.length > 0 && !q && page === 1 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Featured</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((m) => {
              const displayAmount = getCarDisplayPrice(Number(m.basePriceRmb), displayCurrency, fx);
              return (
                <MotorcycleCard
                  key={m.id}
                  motorcycle={m}
                  displayAmount={displayAmount}
                  displayCurrency={displayCurrency}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">{total} listing{total === 1 ? "" : "s"}</h2>
          <Link href="/inventory" className="text-xs text-muted-foreground hover:text-[var(--brand)]">Browse cars →</Link>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {motorcycles.map((m) => {
            const displayAmount = getCarDisplayPrice(Number(m.basePriceRmb), displayCurrency, fx);
            const ineligible = getCarCheckoutIneligibleReason(m);
            let reservationDepositHint: string | null = null;
            if (!ineligible) {
              const snap = computeDepositCheckoutSnapshot(m, fx, m.reservationDepositPercent != null ? Number(m.reservationDepositPercent) : null, globalDepositPct);
              if (snap) reservationDepositHint = `${snap.depositPercentApplied}% dep. · GHS ${Math.round(snap.depositGhs).toLocaleString()}`;
            }
            const video = m.videos[0];
            const videoTeaser = video
              ? { posterUrl: resolveCarVideoPosterUrl({ url: video.url, thumbnailUrl: video.thumbnailUrl, publicId: video.publicId }) }
              : null;
            return (
              <MotorcycleCard
                key={m.id}
                motorcycle={m}
                displayAmount={displayAmount}
                displayCurrency={displayCurrency}
                reservationDepositHint={reservationDepositHint}
                videoTeaser={videoTeaser}
              />
            );
          })}
        </div>
        {motorcycles.length === 0 ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">No motorcycles match your filters.</p>
        ) : null}
        <ListPaginationFooter
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          itemLabel="Motorcycles"
          prevHref={page > 1 ? pageHref(page - 1) : null}
          nextHref={page < totalPages ? pageHref(page + 1) : null}
          pageHrefs={totalPages > 1 ? Array.from({ length: totalPages }, (_, i) => pageHref(i + 1)) : undefined}
          className="mt-8"
        />
      </section>
    </div>
  );
}
