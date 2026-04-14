import { AvailabilityStatus, CarListingState, type Prisma, SourceType } from "@prisma/client";
import { cookies } from "next/headers";

import { CarCard } from "@/components/cars/car-card";
import { PageHeading } from "@/components/typography/page-headings";
import { getCarDisplayPrice, getGlobalCurrencySettings, parseDisplayCurrency } from "@/lib/currency";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type StockFilter = "all" | "available" | "sold" | "transit";

function parseStockFilter(raw: string | undefined): StockFilter {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v === "available" || v === "sold" || v === "transit") return v;
  return "all";
}

export default async function InventoryPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const brand = typeof sp.brand === "string" ? sp.brand.trim() : "";
  const source = typeof sp.source === "string" ? sp.source.trim() : "";
  const stock = parseStockFilter(typeof sp.availability === "string" ? sp.availability : undefined);

  const cookieStore = await cookies();
  const displayCurrency = parseDisplayCurrency(cookieStore.get("sda_currency")?.value);
  const fx = await getGlobalCurrencySettings();

  const andClauses: Prisma.CarWhereInput[] = [];

  if (stock === "available") {
    andClauses.push({
      listingState: CarListingState.PUBLISHED,
      availabilityStatus: AvailabilityStatus.AVAILABLE,
      sourceType: { in: [SourceType.IN_GHANA, SourceType.IN_CHINA] },
    });
  } else if (stock === "sold") {
    andClauses.push({
      OR: [{ listingState: CarListingState.SOLD }, { availabilityStatus: AvailabilityStatus.SOLD }],
    });
  } else if (stock === "transit") {
    andClauses.push({
      sourceType: SourceType.IN_TRANSIT,
      listingState: { in: [CarListingState.PUBLISHED, CarListingState.SOLD] },
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
  if (source && Object.values(SourceType).includes(source as SourceType)) {
    andClauses.push({ sourceType: source as SourceType });
  }

  const cars = await prisma.car.findMany({
    where: { AND: andClauses },
    orderBy: [{ featured: "desc" }, { listingState: "asc" }, { updatedAt: "desc" }],
    take: 80,
  });

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
            <option value="">All listings</option>
            <option value="available">Available to buy</option>
            <option value="sold">Sold</option>
            <option value="transit">In transit</option>
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
            <option value="">Any</option>
            <option value="IN_GHANA">Ghana</option>
            <option value="IN_CHINA">China</option>
            <option value="IN_TRANSIT">In transit</option>
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
        <span className="font-medium text-zinc-500">Available to buy</span> shows Ghana and China stock you can pay
        for online. <span className="font-medium text-zinc-500">Sold</span> and <span className="font-medium text-zinc-500">In transit</span> are browse-only; checkout stays disabled until stock is ready or operations lists a new unit.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}
