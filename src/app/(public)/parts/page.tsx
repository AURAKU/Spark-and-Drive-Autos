import { PartListingState } from "@prisma/client";
import { cookies } from "next/headers";

import { SourcingFlags } from "@/components/landing/sourcing-flags";
import { CartIconButton } from "@/components/parts/cart-icon-button";
import { PartCard } from "@/components/parts/part-card";
import { getGlobalCurrencySettings, parseDisplayCurrency } from "@/lib/currency";
import { getPartDisplayPrice } from "@/lib/parts-pricing";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";
import { PartsWalletPanel } from "@/components/parts/parts-wallet-panel";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Parts & Accessories | Spark and Drive Autos",
  description: "Browse parts and accessories in a dedicated catalog separate from vehicle inventory.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const sortSchema = z
  .enum(["newest", "price_asc", "price_desc", "only_autoparts", "only_car_accessories"])
  .catch("newest");

export default async function PartsStorefrontPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const cookieStore = await cookies();
  const displayCurrency = parseDisplayCurrency(cookieStore.get("sda_currency")?.value);
  const fx = await getGlobalCurrencySettings();
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const category = typeof sp.category === "string" ? sp.category.trim() : "";
  const origin = typeof sp.origin === "string" ? sp.origin.trim() : "";
  const sort = sortSchema.parse(typeof sp.sort === "string" ? sp.sort.trim() : "newest");
  const session = await safeAuth();

  let parts = await prisma.part.findMany({
    where: {
      listingState: PartListingState.PUBLISHED,
      AND: [
        q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { shortDescription: { contains: q, mode: "insensitive" } },
                { category: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        category ? { category: { equals: category, mode: "insensitive" } } : {},
        origin === "GHANA" || origin === "CHINA" ? { origin: origin as "GHANA" | "CHINA" } : {},
      ],
    },
    orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
    take: 60,
  });
  if (sort === "price_asc") {
    parts = [...parts].sort((a, b) => {
      const ap = getPartDisplayPrice(
        { origin: a.origin, basePriceRmb: Number(a.basePriceRmb), priceGhs: Number(a.priceGhs) },
        displayCurrency,
        fx,
      ).amount;
      const bp = getPartDisplayPrice(
        { origin: b.origin, basePriceRmb: Number(b.basePriceRmb), priceGhs: Number(b.priceGhs) },
        displayCurrency,
        fx,
      ).amount;
      return ap - bp;
    });
  } else if (sort === "price_desc") {
    parts = [...parts].sort((a, b) => {
      const ap = getPartDisplayPrice(
        { origin: a.origin, basePriceRmb: Number(a.basePriceRmb), priceGhs: Number(a.priceGhs) },
        displayCurrency,
        fx,
      ).amount;
      const bp = getPartDisplayPrice(
        { origin: b.origin, basePriceRmb: Number(b.basePriceRmb), priceGhs: Number(b.priceGhs) },
        displayCurrency,
        fx,
      ).amount;
      return bp - ap;
    });
  } else if (sort === "only_autoparts") {
    parts = parts.filter((p) => {
      const category = p.category.toLowerCase();
      const title = p.title.toLowerCase();
      return category === "autoparts" || category === "auto parts" || category.includes("part") || title.includes("part");
    });
  } else if (sort === "only_car_accessories") {
    parts = parts.filter((p) => {
      const category = p.category.toLowerCase();
      const title = p.title.toLowerCase();
      return (
        category === "car accessories" ||
        category === "accessories" ||
        category.includes("accessor") ||
        title.includes("accessor")
      );
    });
  } else {
    parts = [...parts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  const categories = await prisma.partCategory.findMany({
    where: { active: true },
    select: { name: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const me =
    session?.user?.id != null
      ? await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { walletBalance: true },
        })
      : null;
  const favoriteRows =
    session?.user?.id != null
      ? await prisma.partFavorite.findMany({
          where: { userId: session.user.id },
          select: { partId: true },
        })
      : [];
  const favoriteIds = new Set(favoriteRows.map((f) => f.partId));

  return (
    <div className="parts-theme relative [--brand:#ef4444]">
      <div
        className="parts-theme-bg pointer-events-none absolute inset-0 -z-10 opacity-80"
        style={{
          backgroundImage:
            "radial-gradient(980px 520px at 10% 8%, rgba(239,68,68,0.24), transparent), radial-gradient(760px 440px at 92% 16%, rgba(255,255,255,0.1), transparent), linear-gradient(180deg, rgba(4,4,5,0.95), rgba(10,10,12,0.9)), url('/brand/gear-storefront-theme.png')",
          backgroundBlendMode: "screen,screen,normal,overlay",
          backgroundSize: "auto,auto,auto,cover",
        }}
      />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="parts-hero relative overflow-hidden rounded-3xl border border-red-300/25 bg-black/40 p-6 shadow-[0_0_55px_-24px_rgba(239,68,68,0.65)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-red-500/18 via-transparent to-white/5" />
          <div className="relative flex flex-col gap-6">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                <span className="inline-block bg-gradient-to-r from-white via-red-100 to-red-300 bg-clip-text text-transparent drop-shadow-[0_0_14px_rgba(239,68,68,0.65)]">
                  Spark and Drive Gear Storefront
                </span>
              </h1>
              <div className="mt-4">
                <SourcingFlags tone="gear" className="justify-start" />
              </div>
              <p className="mt-5 text-xl font-bold tracking-wide text-zinc-100 sm:text-2xl">Find Parts &amp; Accessories</p>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-200 sm:text-lg">
                Upgrade, replace, and personalize your vehicle with OEM parts or high-quality aftermarket options
                perfectly suited to your car.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <CartIconButton className="size-11 rounded-xl border border-red-300/40 bg-red-500/20 text-red-100 shadow-[0_0_26px_-10px_rgba(239,68,68,0.9)] transition hover:bg-red-500/30" />
                <form action="/parts" method="get" className="flex h-11 w-full max-w-xl items-center overflow-hidden rounded-xl border border-red-300/35 bg-black/40 shadow-[0_0_26px_-14px_rgba(239,68,68,0.85)]">
                  {category ? <input type="hidden" name="category" value={category} /> : null}
                  {origin ? <input type="hidden" name="origin" value={origin} /> : null}
                  {sort ? <input type="hidden" name="sort" value={sort} /> : null}
                  <label htmlFor="hero-q" className="sr-only">
                    Search parts
                  </label>
                  <input
                    id="hero-q"
                    name="q"
                    defaultValue={q}
                    placeholder="Search parts and accessories..."
                    className="h-full w-full bg-transparent px-4 text-sm font-semibold text-white outline-none placeholder:text-zinc-300"
                  />
                  <button
                    type="submit"
                    className="h-full shrink-0 bg-red-500 px-4 text-sm font-bold text-white transition hover:bg-red-400"
                  >
                    Search
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>

      <div className="mt-6">
        <PartsWalletPanel walletBalance={Number(me?.walletBalance ?? 0)} isSignedIn={Boolean(session?.user?.id)} />
      </div>

      <form
        className="parts-filters mt-8 flex flex-col gap-3 rounded-2xl border border-red-300/20 bg-black/35 p-4 shadow-[0_0_34px_-24px_rgba(239,68,68,0.9)] sm:flex-row sm:items-end"
        action="/parts"
        method="get"
      >
        {q ? <input type="hidden" name="q" value={q} /> : null}
        <div className="w-full space-y-2 sm:w-56">
          <label className="text-xs font-semibold text-zinc-300" htmlFor="category">
            Category
          </label>
          <select
            id="category"
            name="category"
            defaultValue={category}
            className="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
          >
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full space-y-2 sm:w-52">
          <label className="text-xs font-semibold text-zinc-300" htmlFor="origin">
            Origin
          </label>
          <select
            id="origin"
            name="origin"
            defaultValue={origin}
            className="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
          >
            <option value="">All</option>
            <option value="GHANA">Listed in Ghana</option>
            <option value="CHINA">Listed in China</option>
          </select>
        </div>
        <div className="w-full space-y-2 sm:w-56">
          <label className="text-xs font-semibold text-zinc-300" htmlFor="sort">
            Sort
          </label>
          <select
            id="sort"
            name="sort"
            defaultValue={sort}
            className="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
          >
            <option value="newest">Newest products</option>
            <option value="price_asc">Price: lowest to highest</option>
            <option value="price_desc">(highest to lowest)</option>
            <option value="only_autoparts">(Only AutoParts)</option>
            <option value="only_car_accessories">(Only Car Accessories)</option>
          </select>
        </div>
        <button
          type="submit"
          className="h-10 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-[0_10px_22px_-14px_rgba(239,68,68,1)] transition hover:brightness-110"
        >
          Search
        </button>
      </form>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {parts.length === 0 ? (
          <p className="text-sm text-zinc-500 sm:col-span-2 lg:col-span-3">
            No published parts yet. Check back soon, or reach out via chat for specific requests.
          </p>
        ) : (
          parts.map((p) => (
            <PartCard
              key={p.id}
              part={p}
              displayCurrency={displayCurrency}
              fx={fx}
              isFavorite={favoriteIds.has(p.id)}
              canFavorite={Boolean(session?.user?.id)}
            />
          ))
        )}
      </div>
      </div>
    </div>
  );
}
