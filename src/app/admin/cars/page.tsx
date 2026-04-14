import Link from "next/link";

import { AddVehicleDialog } from "@/components/admin/add-vehicle-dialog";
import { PageHeading } from "@/components/typography/page-headings";
import {
  CAR_OPS_STATE_LABELS,
  CAR_OPS_STATE_VALUES,
  carWhereForOpsState,
  parseCarOpsStateFilter,
} from "@/lib/admin-car-ops-state";
import { formatConverted, formatVehiclePriceFromRmb, getGlobalCurrencySettings } from "@/lib/currency";
import { prisma } from "@/lib/prisma";

import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminCarsPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const sort = typeof sp.sort === "string" ? sp.sort : "updated";
  const ops = parseCarOpsStateFilter(typeof sp.ops === "string" ? sp.ops : undefined);
  const featuredOnly = sp.featured === "1";
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);
  const addVehicle = sp.add === "1";

  const where: Prisma.CarWhereInput = {
    AND: [
      q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { brand: { contains: q, mode: "insensitive" } },
              { model: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      ops ? carWhereForOpsState(ops) : {},
      featuredOnly ? { featured: true } : {},
    ],
  };

  let orderBy: Prisma.CarOrderByWithRelationInput | Prisma.CarOrderByWithRelationInput[] = { updatedAt: "desc" };
  if (sort === "price_asc") orderBy = { basePriceRmb: "asc" };
  if (sort === "price_desc") orderBy = { basePriceRmb: "desc" };
  if (sort === "title") orderBy = { title: "asc" };
  if (sort === "newest") orderBy = { createdAt: "desc" };
  if (sort === "updated") orderBy = { updatedAt: "desc" };

  const [total, cars, fx] = await Promise.all([
    prisma.car.count({ where }),
    prisma.car.findMany({ where, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    getGlobalCurrencySettings(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildPageHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sort !== "updated") params.set("sort", sort);
    if (ops) params.set("ops", ops);
    if (featuredOnly) params.set("featured", "1");
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/admin/cars?${qs}` : "/admin/cars";
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <PageHeading variant="dashboard">Cars Inventory</PageHeading>
          <p className="mt-1 text-sm text-zinc-500">
            Search, filter, and edit listings. Base price is CNY; GHS updates from{" "}
            <Link className="text-[var(--brand)] hover:underline" href="/admin/settings/currency">
              exchange rates
            </Link>
            .
          </p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-500">
            <Link className="text-[var(--brand)] hover:underline" href="/admin/import-export?inventory=cars">
              BULK CSV import / export for cars
            </Link>
            <Link className="text-[var(--brand)] hover:underline" href="/admin/duplicates">
              Duplicate inventory (vehicle clusters)
            </Link>
          </p>
          <p className="mt-1 text-xs text-zinc-600 lg:hidden">Swipe horizontally on small screens to see all columns.</p>
        </div>
        <AddVehicleDialog initialOpen={addVehicle} />
      </div>

      <form
        className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:flex-row lg:flex-wrap lg:items-end"
        action="/admin/cars"
        method="get"
      >
        <div className="min-w-0 flex-1 space-y-2">
          <label className="text-xs text-zinc-500" htmlFor="q">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Title, brand, slug…"
            className="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none ring-[var(--brand)]/40 focus:ring-2"
          />
        </div>
        <div className="w-full space-y-2 lg:w-56">
          <label className="text-xs text-zinc-500" htmlFor="ops">
            Listing state
          </label>
          <select
            id="ops"
            name="ops"
            defaultValue={ops}
            className="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
          >
            <option value="">Any</option>
            {CAR_OPS_STATE_VALUES.map((v) => (
              <option key={v} value={v}>
                {CAR_OPS_STATE_LABELS[v]}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full space-y-2 lg:w-44">
          <label className="text-xs text-zinc-500" htmlFor="sort">
            Sort
          </label>
          <select
            id="sort"
            name="sort"
            defaultValue={sort}
            className="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
          >
            <option value="updated">Last updated</option>
            <option value="newest">Newest</option>
            <option value="title">Title A–Z</option>
            <option value="price_asc">Base RMB ↑</option>
            <option value="price_desc">Base RMB (high to low)</option>
          </select>
        </div>
        <div className="flex items-center gap-2 pb-0.5">
          <input
            id="featured"
            name="featured"
            type="checkbox"
            value="1"
            defaultChecked={featuredOnly}
            className="size-4 rounded border-white/20"
          />
          <label htmlFor="featured" className="text-sm text-zinc-400">
            Featured only
          </label>
        </div>
        <button
          type="submit"
          className="h-10 shrink-0 rounded-lg bg-[var(--brand)] px-5 text-sm font-medium text-black hover:opacity-90"
        >
          Apply
        </button>
      </form>

      <p className="mt-4 text-xs text-zinc-500">
        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} vehicles
      </p>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs tracking-wide text-zinc-500 uppercase">
            <tr>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Listing</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Feat.</th>
              <th className="px-4 py-3">Base (CNY)</th>
              <th className="px-4 py-3">GHS (saved)</th>
              <th className="px-4 py-3">GHS (live)</th>
              <th className="px-4 py-3">USD (live)</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {cars.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                  No vehicles match. Adjust filters or add a listing.
                </td>
              </tr>
            ) : (
              cars.map((c) => {
                const base = Number(c.basePriceRmb);
                return (
                  <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{c.title}</p>
                      <p className="text-xs text-zinc-500">
                        {c.brand} {c.model} · {c.year}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{c.listingState.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 text-zinc-400">{c.availabilityStatus.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 text-zinc-400">{c.featured ? "Yes" : "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-300">{base.toLocaleString()}</td>
                    <td className="px-4 py-3 text-zinc-300">{formatConverted(Number(c.price), "GHS")}</td>
                    <td className="px-4 py-3 text-[var(--brand)]">{formatVehiclePriceFromRmb(base, "GHS", fx)}</td>
                    <td className="px-4 py-3 text-zinc-300">{formatVehiclePriceFromRmb(base, "USD", fx)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link className="text-[var(--brand)] hover:underline" href={`/admin/cars/${c.id}/edit`}>
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {page > 1 ? (
            <Link
              href={buildPageHref(page - 1)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/5"
            >
              Previous
            </Link>
          ) : null}
          <span className="text-sm text-zinc-500">
            Page {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={buildPageHref(page + 1)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/5"
            >
              Next
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
