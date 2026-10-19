import { PartListingState } from "@prisma/client";
import { cookies } from "next/headers";
import Link from "next/link";

import { CartIconButton } from "@/components/parts/cart-icon-button";
import { PartCard } from "@/components/parts/part-card";
import { PartsCatalogSearch } from "@/components/parts/parts-catalog-search";
import { PartsShopNav, shopIcons } from "@/components/parts/parts-shop-nav";
import { PartsWalletPanel } from "@/components/parts/parts-wallet-panel";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { getGlobalCurrencySettings, parseDisplayCurrency } from "@/lib/currency";
import { normalizeIntelListPage } from "@/lib/ops";
import { buildPartCatalogWhere, normalizePartSearch, partExactCodeWhere } from "@/lib/part-catalog-query";
import { publicPartListSelect } from "@/lib/part-public-data";
import { parsePublicStockFilter, stockFilterToOrigin, type PublicStockFilter } from "@/lib/part-stock-class";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Parts & Accessories | Spark and Drive Autos",
  description: "Search OEM numbers and shop Ghana Stock or Overseas Stock parts and accessories.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const PAGE_SIZE = 12;
const sortSchema = z.enum(["newest", "price_asc", "price_desc", "only_autoparts", "only_car_accessories"]).catch("newest");

function readString(sp: Record<string, string | string[] | undefined>, key: string): string {
  const value = sp[key];
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.find((item) => typeof item === "string")?.trim() ?? "";
  return "";
}

function readPage(sp: Record<string, string | string[] | undefined>): number {
  const raw = readString(sp, "page");
  if (!raw) return 1;
  const parsed = parseInt(raw, 10);
  return normalizeIntelListPage(Number.isFinite(parsed) ? parsed : undefined);
}

function catalogHref(input: {
  q: string;
  category: string;
  stock: PublicStockFilter;
  sort: string;
  make: string;
  model: string;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.category) params.set("category", input.category);
  if (input.stock !== "all") params.set("stock", input.stock);
  if (input.sort && input.sort !== "newest") params.set("sort", input.sort);
  if (input.make) params.set("make", input.make);
  if (input.model) params.set("model", input.model);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  const qs = params.toString();
  return qs ? `/parts?${qs}` : "/parts";
}

export default async function PartsStorefrontPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const cookieStore = await cookies();
  const displayCurrency = parseDisplayCurrency(cookieStore.get("sda_currency")?.value);
  const fx = await getGlobalCurrencySettings();
  const q = normalizePartSearch(readString(sp, "q"));
  const category = readString(sp, "category");
  const stock = parsePublicStockFilter(readString(sp, "stock"), readString(sp, "origin"));
  const sort = sortSchema.parse(readString(sp, "sort") || "newest");
  const make = readString(sp, "make");
  const model = readString(sp, "model");
  const pageReq = readPage(sp);
  const session = await safeAuth();
  const origin = stockFilterToOrigin(stock);

  const where = {
    AND: [
      buildPartCatalogWhere({ q, category, origin, make, model }),
      sort === "only_autoparts"
        ? {
            OR: [
              { category: { contains: "autopart", mode: "insensitive" as const } },
              { category: { contains: "auto part", mode: "insensitive" as const } },
              { title: { contains: "part", mode: "insensitive" as const } },
            ],
          }
        : {},
      sort === "only_car_accessories"
        ? {
            OR: [
              { category: { contains: "accessor", mode: "insensitive" as const } },
              { title: { contains: "accessor", mode: "insensitive" as const } },
            ],
          }
        : {},
    ],
  };

  const orderBy =
    sort === "price_asc" || sort === "price_desc"
      ? [{ priceGhs: sort === "price_asc" ? ("asc" as const) : ("desc" as const) }]
      : [{ featured: "desc" as const }, { updatedAt: "desc" as const }];

  const total = await prisma.part.count({ where });
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / PAGE_SIZE));
  const page = Math.min(Math.max(1, pageReq), totalPages);

  const [parts, exactMatches, categories, vehicles, me, favoriteRows] = await Promise.all([
    prisma.part.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: publicPartListSelect,
    }),
    q
      ? prisma.part.findMany({
          where: { AND: [where, partExactCodeWhere(q)] },
          take: 8,
          select: { id: true },
        })
      : Promise.resolve([]),
    prisma.partCategory.findMany({
      where: { active: true },
      select: { name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.part.groupBy({
      by: ["compatibleMake", "compatibleModel"],
      where: {
        listingState: PartListingState.PUBLISHED,
        compatibleMake: { not: null },
      },
    }),
    session?.user?.id
      ? prisma.user.findUnique({ where: { id: session.user.id }, select: { walletBalance: true } })
      : Promise.resolve(null),
    session?.user?.id
      ? prisma.partFavorite.findMany({ where: { userId: session.user.id }, select: { partId: true } })
      : Promise.resolve([]),
  ]);

  const exactIds = new Set(exactMatches.map((part) => part.id));
  const orderedParts =
    exactIds.size > 0
      ? [...parts].sort((a, b) => Number(exactIds.has(b.id)) - Number(exactIds.has(a.id)))
      : parts;
  const favoriteIds = new Set(favoriteRows.map((row) => row.partId));
  const makes = [...new Set(vehicles.map((row) => row.compatibleMake).filter((value): value is string => Boolean(value)))].sort();
  const models = [
    ...new Set(
      vehicles
        .filter((row) => !make || row.compatibleMake?.toLowerCase() === make.toLowerCase())
        .map((row) => row.compatibleModel)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort();

  const href = (next: Partial<{ q: string; category: string; stock: PublicStockFilter; sort: string; make: string; model: string; page: number }>) =>
    catalogHref({
      q: next.q ?? q,
      category: next.category ?? category,
      stock: next.stock ?? stock,
      sort: next.sort ?? sort,
      make: next.make ?? make,
      model: next.model ?? model,
      page: next.page,
    });

  const sourcingParams = new URLSearchParams();
  if (q) sourcingParams.set("q", q);
  if (make) sourcingParams.set("vehicleMake", make);
  if (model) sourcingParams.set("vehicleModel", model);
  const sourcingHref = sourcingParams.toString() ? `/request-autoparts?${sourcingParams.toString()}` : "/request-autoparts";
  const categoryNames = categories.map((item) => item.name);
  const matchCategory = (words: string[]) =>
    categoryNames.find((name) => words.some((word) => name.toLowerCase().includes(word))) ?? "";
  const browseHref = (words: string[], fallbackQuery: string) => {
    const matched = matchCategory(words);
    return matched ? href({ category: matched, q: "", page: 1 }) : href({ category: "", q: fallbackQuery, page: 1 });
  };
  const isBrowseActive = (words: string[], fallbackQuery: string) => {
    const matched = matchCategory(words);
    if (matched) return category.toLowerCase() === matched.toLowerCase();
    return q.toLowerCase() === fallbackQuery.toLowerCase();
  };
  const knownWords = ["brake", "engine", "filter", "light", "lamp", "electrical", "suspension", "shock", "oil", "fluid", "wheel", "tyre", "tire", "tool", "accessor"];
  const extraCategories = categoryNames.filter((name) => !knownWords.some((word) => name.toLowerCase().includes(word)));

  const chips = [
    q ? { label: q, href: href({ q: "", page: 1 }) } : null,
    category ? { label: category, href: href({ category: "", page: 1 }) } : null,
    stock !== "all" ? { label: stock === "ghana" ? "Ghana Stock" : "Overseas Stock", href: href({ stock: "all", page: 1 }) } : null,
    make ? { label: make, href: href({ make: "", model: "", page: 1 }) } : null,
    model ? { label: model, href: href({ model: "", page: 1 }) } : null,
  ].filter((chip): chip is { label: string; href: string } => Boolean(chip));

  return (
    <div className="parts-theme relative isolate [--brand:#ef4444]">
      <div className="relative z-[1] mx-auto min-w-0 max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 basis-48">
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Parts &amp; Accessories</h1>
            <p className="mt-1 text-sm text-zinc-400">Pick a group, then the part. Ghana Stock is ready locally. Overseas Stock ships in.</p>
          </div>
          <div className="flex w-max shrink-0 items-center gap-2">
            <PartsWalletPanel walletBalance={Number(me?.walletBalance ?? 0)} isSignedIn={Boolean(session?.user?.id)} />
            <CartIconButton className="size-11 shrink-0 rounded-xl border border-white/15 bg-white/5 text-white" />
          </div>
        </div>

        <PartsShopNav
          lanes={[
            {
              id: "parts",
              label: "Parts",
              hint: "Everything in the shop",
              href: href({ category: "", q: "", page: 1 }),
              active: !category && !q,
              icon: shopIcons.parts,
            },
            {
              id: "tools",
              label: "Tools",
              hint: "Workshop and hand tools",
              href: browseHref(["tool"], "tools"),
              active: isBrowseActive(["tool"], "tools"),
              icon: shopIcons.tools,
            },
            {
              id: "accessories",
              label: "Accessories",
              hint: "Add-ons for the car",
              href: browseHref(["accessor"], "accessories"),
              active: isBrowseActive(["accessor"], "accessories"),
              icon: shopIcons.accessories,
            },
          ]}
          departments={[
            { id: "brakes", label: "Brakes", hint: "Pads, discs, sensors", href: browseHref(["brake"], "brakes"), active: isBrowseActive(["brake"], "brakes"), icon: shopIcons.brakes },
            { id: "engine", label: "Engine", hint: "Belts, pumps, mounts", href: browseHref(["engine"], "engine"), active: isBrowseActive(["engine"], "engine"), icon: shopIcons.engine },
            { id: "filters", label: "Filters", hint: "Oil, air, cabin", href: browseHref(["filter"], "filters"), active: isBrowseActive(["filter"], "filters"), icon: shopIcons.filters },
            { id: "lights", label: "Lights", hint: "Bulbs and lamps", href: browseHref(["light", "lamp", "electrical"], "lights"), active: isBrowseActive(["light", "lamp", "electrical"], "lights"), icon: shopIcons.lights },
            { id: "suspension", label: "Suspension", hint: "Shocks and arms", href: browseHref(["suspension", "shock"], "suspension"), active: isBrowseActive(["suspension", "shock"], "suspension"), icon: shopIcons.suspension },
            { id: "fluids", label: "Fluids", hint: "Oil and coolants", href: browseHref(["oil", "fluid"], "fluids"), active: isBrowseActive(["oil", "fluid"], "fluids"), icon: shopIcons.fluids },
            { id: "wheels", label: "Wheels", hint: "Tyres and rims", href: browseHref(["wheel", "tyre", "tire"], "wheels"), active: isBrowseActive(["wheel", "tyre", "tire"], "wheels"), icon: shopIcons.wheels },
          ]}
          stock={[
            { id: "all", label: "All Stock", hint: "", href: href({ stock: "all", page: 1 }), active: stock === "all", icon: shopIcons.all },
            { id: "ghana", label: "Ghana Stock", hint: "", href: href({ stock: "ghana", page: 1 }), active: stock === "ghana", icon: shopIcons.ghana },
            { id: "overseas", label: "Overseas Stock", hint: "", href: href({ stock: "overseas", page: 1 }), active: stock === "overseas", icon: shopIcons.overseas },
          ]}
        />

        <div className="mt-4">
          <PartsCatalogSearch
            initialQuery={q}
            hidden={{
              category,
              stock: stock === "all" ? "" : stock,
              sort: sort === "newest" ? "" : sort,
              make,
              model,
            }}
          />
        </div>

        {extraCategories.length > 0 ? (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="More categories">
            {extraCategories.map((name) => (
              <Link
                key={name}
                href={href({ category: name, q: "", page: 1 })}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  category.toLowerCase() === name.toLowerCase()
                    ? "bg-white text-black"
                    : "border border-white/15 text-zinc-200"
                }`}
              >
                {name}
              </Link>
            ))}
          </div>
        ) : null}

        {makes.length > 0 ? (
          <form action="/parts" method="get" className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
            {q ? <input type="hidden" name="q" value={q} /> : null}
            {category ? <input type="hidden" name="category" value={category} /> : null}
            {stock !== "all" ? <input type="hidden" name="stock" value={stock} /> : null}
            {sort !== "newest" ? <input type="hidden" name="sort" value={sort} /> : null}
            <label className="text-xs text-zinc-400">
              Shop for your vehicle
              <select name="make" defaultValue={make} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white">
                <option value="">Any make</option>
                {makes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-zinc-400">
              Model
              <select name="model" defaultValue={model} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white">
                <option value="">Any model</option>
                {models.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="h-10 self-end rounded-lg bg-white/10 px-4 text-sm font-semibold text-white">
              Apply
            </button>
            {make || model ? (
              <Link href={href({ make: "", model: "", page: 1 })} className="self-end text-sm text-zinc-300 underline">
                Clear vehicle
              </Link>
            ) : null}
          </form>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <Link key={chip.label} href={chip.href} className="rounded-full border border-white/15 px-3 py-1 text-xs text-zinc-200">
                {chip.label} ×
              </Link>
            ))}
            {chips.length > 1 ? (
              <Link href="/parts" className="rounded-full px-3 py-1 text-xs text-zinc-400 underline">
                Clear all
              </Link>
            ) : null}
          </div>
          <form action="/parts" method="get" className="flex items-center gap-2">
            {q ? <input type="hidden" name="q" value={q} /> : null}
            {category ? <input type="hidden" name="category" value={category} /> : null}
            {stock !== "all" ? <input type="hidden" name="stock" value={stock} /> : null}
            {make ? <input type="hidden" name="make" value={make} /> : null}
            {model ? <input type="hidden" name="model" value={model} /> : null}
            <label htmlFor="parts-sort" className="sr-only">
              Sort
            </label>
            <select
              id="parts-sort"
              name="sort"
              defaultValue={sort === "only_autoparts" || sort === "only_car_accessories" ? "newest" : sort}
              className="h-10 rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white"
            >
              <option value="newest">Recommended</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
            <button type="submit" className="h-10 rounded-lg border border-white/15 px-3 text-sm text-white">
              Sort
            </button>
          </form>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orderedParts.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:col-span-2 lg:col-span-3">
              <p className="text-base font-semibold text-white">No matching parts found.</p>
              <p className="mt-2 text-sm text-zinc-400">Try another OEM number, clear a filter, or ask us to source it.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/parts" className="inline-flex h-10 items-center rounded-lg border border-white/15 px-4 text-sm text-white">
                  Clear filters
                </Link>
                <Link href="/parts-finder" className="inline-flex h-10 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white">
                  Use Parts Finder
                </Link>
                <Link href={sourcingHref} className="inline-flex h-10 items-center rounded-lg border border-white/15 px-4 text-sm text-white">
                  Request sourcing
                </Link>
              </div>
            </div>
          ) : (
            orderedParts.map((part) => (
              <PartCard
                key={part.id}
                part={part}
                displayCurrency={displayCurrency}
                fx={fx}
                isFavorite={favoriteIds.has(part.id)}
                canFavorite={Boolean(session?.user?.id)}
                fitsVehicle={Boolean(
                  make &&
                    model &&
                    part.compatibleMake?.toLowerCase() === make.toLowerCase() &&
                    part.compatibleModel?.toLowerCase() === model.toLowerCase(),
                )}
              />
            ))
          )}
        </div>

        {total > 0 ? (
          <ListPaginationFooter
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={PAGE_SIZE}
            itemLabel="Products"
            prevHref={page > 1 ? href({ page: page - 1 }) : null}
            nextHref={page < totalPages ? href({ page: page + 1 }) : null}
            pageHrefs={totalPages > 1 ? Array.from({ length: totalPages }, (_, index) => href({ page: index + 1 })) : undefined}
          />
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-zinc-300">Can’t find the right part?</p>
          <Link href="/parts-finder" className="text-sm font-semibold text-[var(--brand)]">
            Check with Parts Finder
          </Link>
        </div>

      </div>
    </div>
  );
}
