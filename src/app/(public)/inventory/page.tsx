import { AvailabilityStatus, CarListingState, type Prisma, SourceType } from "@prisma/client";
import { cookies } from "next/headers";

import { CarCard } from "@/components/cars/car-card";
import { PageHeading } from "@/components/typography/page-headings";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { getCarDisplayPrice, getGlobalCurrencySettings, parseDisplayCurrency } from "@/lib/currency";
import { normalizeIntelListPage } from "@/lib/ops";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const PAGE_SIZE = 10;

/** Next.js may provide string or string[] for repeated keys — normalize to one value. */
function firstQueryValue(sp: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    const first = v.find((x): x is string => typeof x === "string" && x.length > 0);
    return first;
  }
  return undefined;
}

function readPage(sp: Record<string, string | string[] | undefined>, key: string): number {
  const s = firstQueryValue(sp, key);
  if (s == null || s === "") return 1;
  const n = parseInt(s, 10);
  return normalizeIntelListPage(Number.isFinite(n) ? n : undefined);
}

type StockFilter = "all" | "available" | "sold";

function parseStockFilter(raw: string): StockFilter {
  const v = raw.trim().toLowerCase();
  if (v === "available" || v === "sold") return v;
  return "all";
}

/** Browse inventory is Ghana + China only; in-transit units are excluded. */
const BROWSE_SOURCE_TYPES: SourceType[] = [SourceType.IN_GHANA, SourceType.IN_CHINA];

export default async function InventoryPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const q = (firstQueryValue(sp, "q") ?? "").trim();
  const brand = (firstQueryValue(sp, "brand") ?? "").trim();
  const rawSource = (firstQueryValue(sp, "source") ?? "").trim().toUpperCase();
  const source = rawSource === "IN_GHANA" || rawSource === "IN_CHINA" ? rawSource : "";
  const stock = parseStockFilter((firstQueryValue(sp, "availability") ?? "").trim().toLowerCase());
  const pageReq = readPage(sp, "page");

  const cookieStore = await cookies();
  const displayCurrency = parseDisplayCurrency(cookieStore.get("sda_currency")?.value);
  const fx = await getGlobalCurrencySettings();

  const andClauses: Prisma.CarWhereInput[] = [];

  andClauses.push({ sourceType: { in: BROWSE_SOURCE_TYPES } });
  andClauses.push({ availabilityStatus: { not: AvailabilityStatus.IN_TRANSIT_STOCK } });

  if (stock === "available") {
    andClauses.push({
      listingState: CarListingState.PUBLISHED,
      availabilityStatus: AvailabilityStatus.AVAILABLE,
    });
  } else if (stock === "sold") {
    andClauses.push({
      OR: [{ listingState: CarListingState.SOLD }, { availabilityStatus: AvailabilityStatus.SOLD }],
    });
  } else {
    andClauses.push({ listingState: { in: [CarListingState.PUBLISHED, CarListingState.SOLD] } });
  }

  if (q) {
    andClauses.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { model: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (brand) {
    andClauses.push({ brand: { equals: brand, mode: "insensitive" } });
  }
  if (source === "IN_GHANA") {
    andClauses.push({ sourceType: SourceType.IN_GHANA });
  } else if (source === "IN_CHINA") {
    andClauses.push({ sourceType: SourceType.IN_CHINA });
  }

  const where: Prisma.CarWhereInput = { AND: andClauses };
  const total = await prisma.car.count({ where });
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / PAGE_SIZE));
  const page = Math.min(Math.max(1, pageReq), totalPages);
  const cars = await prisma.car.findMany({
    where,
    orderBy: [{ featured: "desc" }, { listingState: "asc" }, { updatedAt: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (brand) params.set("brand", brand);
    if (source) params.set("source", source);
    if (stock !== "all") params.set("availability", stock);
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `/inventory?${qs}` : "/inventory";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="max-w-2xl">
        <PageHeading variant="hero" className="mt-1">
          Find Your Next Car
        </PageHeading>
        <p className="mt-4 text-base leading-relaxed text-zinc-300 sm:text-lg">
          Browse through our inventory listings across cars already in Ghana or available in China ready to be shipped.
        </p>
      </div>

      <form
        className="mt-8 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:flex-row lg:flex-wrap lg:items-end"
        action="/inventory"
        method="get"
      >
        <div className="min-w-0 flex-1 space-y-2 lg:min-w-[200px]">
          <label className="text-xs text-zinc-500" htmlFor="q">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Brand, model, keywords"
            className="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none ring-[var(--brand)]/40 focus:ring-2"
          />
        </div>
        <div className="w-full space-y-2 sm:flex-1 sm:min-w-[11rem] lg:w-44">
          <label className="text-xs text-zinc-500" htmlFor="availability">
            Stock status
          </label>
          <select
            id="availability"
            name="availability"
            defaultValue={stock === "all" ? "" : stock}
            className="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
          >
            <option value="">Available or sold</option>
            <option value="available">Available only</option>
            <option value="sold">Sold only</option>
          </select>
        </div>
        <div className="w-full space-y-2 sm:flex-1 sm:min-w-[11rem] lg:w-44">
          <label className="text-xs text-zinc-500" htmlFor="source">
            Source
          </label>
          <select
            id="source"
            name="source"
            defaultValue={source}
            className="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
          >
            <option value="">Ghana or China</option>
            <option value="IN_GHANA">Ghana only</option>
            <option value="IN_CHINA">China only</option>
          </select>
        </div>
        <button
          type="submit"
          className="h-10 rounded-lg bg-[var(--brand)] px-5 text-sm font-medium text-black hover:opacity-90 lg:shrink-0"
        >
          Apply
        </button>
      </form>
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-zinc-600">
        <span className="font-medium text-zinc-500">Available only</span> is Ghana or China stock you can pay for online.{" "}
        <span className="font-medium text-zinc-500">Sold only</span> is browse-only for reference. Source is never in transit
        here, and in-transit stock status is excluded.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {cars.length === 0 ? (
          <p className="text-sm text-zinc-500">No vehicles match your filters yet.</p>
        ) : (
          cars.map((car) => (
            <CarCard
              key={car.id}
              car={car}
              displayAmount={getCarDisplayPrice(Number(car.basePriceRmb), displayCurrency, fx)}
              displayCurrency={displayCurrency}
            />
          ))
        )}
      </div>
      {total > 0 ? (
        <ListPaginationFooter
          className="mt-10"
          showPerPageNote
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          itemLabel="Cars"
          prevHref={page > 1 ? pageHref(page - 1) : null}
          nextHref={page < totalPages ? pageHref(page + 1) : null}
        />
      ) : null}
    </div>
  );
}
