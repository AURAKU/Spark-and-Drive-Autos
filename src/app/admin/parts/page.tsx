import Link from "next/link";

import { AddPartDialog } from "@/components/admin/add-part-dialog";
import { PageHeading } from "@/components/typography/page-headings";
import { PartsCategoriesPanel, PartsDeliveryTemplatesPanel } from "@/components/admin/parts-categories-delivery-panel";
import { formatConverted, getCarDisplayPrice, getGlobalCurrencySettings } from "@/lib/currency";
import { GHANA_LOW_STOCK_ALERT_MAX, getGhanaLowStockPartsForAdmin } from "@/lib/ghana-low-stock";
import { prisma } from "@/lib/prisma";

import { DeliveryMode } from "@prisma/client";
import { PartListingState } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 60;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TAB_VALUES = ["catalog", "categories", "delivery"] as const;
type Tab = (typeof TAB_VALUES)[number];

function parseTab(raw: string | undefined): Tab {
  if (raw && TAB_VALUES.includes(raw as Tab)) return raw as Tab;
  return "catalog";
}

const deliveryDefaults: Record<DeliveryMode, { name: string; etaLabel: string }> = {
  AIR_EXPRESS: { name: "Air Delivery Express", etaLabel: "3 days" },
  AIR_STANDARD: { name: "Normal Air Delivery", etaLabel: "5-10 days" },
  SEA: { name: "Sea Shipping", etaLabel: "35-45 days" },
};

export default async function PartsManagementPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const tab = parseTab(typeof sp.tab === "string" ? sp.tab : undefined);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const category = typeof sp.category === "string" ? sp.category.trim() : "";
  const state =
    typeof sp.state === "string" && Object.values(PartListingState).includes(sp.state as PartListingState)
      ? (sp.state as PartListingState)
      : "";
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);
  const openAdd = sp.add === "1";

  const where: Prisma.PartWhereInput = {
    AND: [
      q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { category: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      category ? { category: { equals: category, mode: "insensitive" } } : {},
      state ? { listingState: state } : {},
    ],
  };

  const [
    fx,
    categoriesForFilter,
    categoriesAll,
    deliveryRows,
    totalParts,
    parts,
 ] = await Promise.all([
    getGlobalCurrencySettings(),
    prisma.part.findMany({
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
    prisma.partCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.deliveryOptionTemplate.findMany({ orderBy: [{ sortOrder: "asc" }, { mode: "asc" }] }),
    prisma.part.count({ where }),
    tab === "catalog"
      ? prisma.part.findMany({
          where,
          orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        })
      : Promise.resolve([]),
  ]);

  const ghanaLowStockParts = await getGhanaLowStockPartsForAdmin();

  const categoriesSelect = categoriesAll.filter((c) => c.active);

  const deliveryByMode = new Map(deliveryRows.map((r) => [r.mode, r]));
  const deliveryModes = Object.keys(deliveryDefaults) as DeliveryMode[];
  const deliveryRowsSerialized: Record<
    string,
    {
      mode: DeliveryMode;
      name: string;
      etaLabel: string;
      feeGhs: number;
      feeRmb: number;
    } | null
  > = {};
  for (const mode of deliveryModes) {
    const row = deliveryByMode.get(mode);
    deliveryRowsSerialized[mode] = row
      ? {
          mode: row.mode,
          name: row.name,
          etaLabel: row.etaLabel,
          feeGhs: Number(row.feeGhs),
          feeRmb: Number(row.feeRmb),
        }
      : null;
  }
  const categoryRows = categoriesAll.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    active: c.active,
  }));
  const totalPages = Math.max(1, Math.ceil(totalParts / PAGE_SIZE));

  const tabLink = (t: Tab, extra?: Record<string, string>) => {
    const params = new URLSearchParams();
    params.set("tab", t);
    if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v);
    return `/admin/parts?${params.toString()}`;
  };

  const catalogPageHref = (p: number) => {
    const params = new URLSearchParams();
    params.set("tab", "catalog");
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (state) params.set("state", state);
    if (p > 1) params.set("page", String(p));
    if (openAdd) params.set("add", "1");
    return `/admin/parts?${params.toString()}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <PageHeading variant="dashboard">Parts Management</PageHeading>
          <p className="mt-1 text-sm text-zinc-500">
            Catalog, categories, and China delivery templates. Customer checkout is <strong className="text-zinc-300">GHS only</strong>;
            list prices are set in <strong className="text-zinc-300">RMB</strong> and converted with{" "}
            <Link className="text-[var(--brand)] hover:underline" href="/admin/settings/currency">
              exchange rates
            </Link>
            .
          </p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-500">
            <Link className="text-[var(--brand)] hover:underline" href="/admin/import-export?inventory=parts">
              BULK CSV import / export for parts
            </Link>
            <Link className="text-[var(--brand)] hover:underline" href="/admin/duplicates">
              Duplicate inventory (parts clusters)
            </Link>
          </p>
        </div>
      </div>

      <nav className="mt-6 flex flex-wrap gap-2 border-b border-white/10 pb-3">
        <Link
          href={tabLink("catalog")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            tab === "catalog" ? "bg-white text-black" : "text-zinc-400 hover:bg-white/5 hover:text-white"
          }`}
        >
          Catalog
        </Link>
        <Link
          href={tabLink("categories")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            tab === "categories" ? "bg-white text-black" : "text-zinc-400 hover:bg-white/5 hover:text-white"
          }`}
        >
          Categories
        </Link>
        <Link
          href={tabLink("delivery")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            tab === "delivery" ? "bg-white text-black" : "text-zinc-400 hover:bg-white/5 hover:text-white"
          }`}
        >
          Delivery options
        </Link>
      </nav>

      {tab === "catalog" && ghanaLowStockParts.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-500/35 bg-amber-500/[0.12] px-4 py-4 text-sm">
          <p className="font-semibold text-amber-100">
            Ghana stock alert — {ghanaLowStockParts.length} SKU{ghanaLowStockParts.length === 1 ? "" : "s"} between 1 and{" "}
            {GHANA_LOW_STOCK_ALERT_MAX} units (published, in Ghana)
          </p>
          <p className="mt-1 text-xs text-amber-200/80">
            Restock before inventory hits zero. Alerts are also sent to admin notifications when stock changes.
          </p>
          <ul className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2">
            {ghanaLowStockParts.slice(0, 16).map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline gap-2 text-zinc-200">
                <Link href={`/admin/parts/${p.id}/edit`} className="font-medium text-[var(--brand)] hover:underline">
                  {p.title}
                </Link>
                <span className="text-zinc-500">
                  {p.stockQty} left{p.sku ? ` · ${p.sku}` : ""}
                </span>
              </li>
            ))}
          </ul>
          {ghanaLowStockParts.length > 16 ? (
            <p className="mt-2 text-xs text-zinc-500">Showing 16 of {ghanaLowStockParts.length}. Refine catalog filters to find specific SKUs.</p>
          ) : null}
        </div>
      ) : null}

      {tab === "catalog" ? (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <AddPartDialog categories={categoriesSelect} initialOpen={openAdd} />
          </div>

          <form
            className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:flex-row lg:flex-wrap lg:items-end"
            action="/admin/parts"
            method="get"
          >
            <input type="hidden" name="tab" value="catalog" />
            <div className="min-w-0 flex-1 space-y-2">
              <label className="text-xs text-zinc-500" htmlFor="q">
                Search
              </label>
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Title, category, slug…"
                className="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none ring-[var(--brand)]/40 focus:ring-2"
              />
            </div>
            <div className="w-full space-y-2 lg:w-44">
              <label className="text-xs text-zinc-500" htmlFor="category">
                Category
              </label>
              <input
                id="category"
                name="category"
                list="part-categories"
                defaultValue={category}
                placeholder="Filter"
                className="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
              />
              <datalist id="part-categories">
                {categoriesForFilter.map((c) => (
                  <option key={c.category} value={c.category} />
                ))}
              </datalist>
            </div>
            <div className="w-full space-y-2 lg:w-44">
              <label className="text-xs text-zinc-500" htmlFor="state">
                Listing state
              </label>
              <select
                id="state"
                name="state"
                defaultValue={state}
                className="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
              >
                <option value="">Any</option>
                {Object.values(PartListingState).map((v) => (
                  <option key={v} value={v}>
                    {v.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="h-10 rounded-lg bg-white/10 px-4 text-sm font-medium text-white transition hover:bg-white/15"
            >
              Apply
            </button>
          </form>

          <p className="mt-3 text-xs text-zinc-500">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalParts)} of {totalParts} SKUs
          </p>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-[920px] w-full border-collapse text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.04] text-xs text-zinc-500 uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">RMB</th>
                  <th className="px-4 py-3 font-medium">GHS (saved)</th>
                  <th className="px-4 py-3 font-medium">GHS (live)</th>
                  <th className="px-4 py-3 font-medium">Origin</th>
                  <th className="px-4 py-3 font-medium">State</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {parts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-zinc-500">
                      No parts match.{" "}
                      <Link className="text-[var(--brand)] hover:underline" href={tabLink("catalog", { add: "1" })}>
                        Add one
                      </Link>
                      .
                    </td>
                  </tr>
                ) : (
                  parts.map((p) => {
                    const ghs = getCarDisplayPrice(Number(p.basePriceRmb), "GHS", fx);
                    return (
                      <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{p.title}</div>
                          <div className="font-mono text-xs text-zinc-500">{p.slug}</div>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">{p.category}</td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-300">
                          {Number(p.basePriceRmb).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">{formatConverted(Number(p.priceGhs), "GHS")}</td>
                        <td className="px-4 py-3 text-[var(--brand)]">{formatConverted(ghs, "GHS")}</td>
                        <td className="px-4 py-3 text-zinc-400">{p.origin}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-md border border-white/10 bg-black/30 px-2 py-0.5 text-xs text-zinc-300">
                            {p.listingState.replaceAll("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-500">{p.updatedAt.toISOString().slice(0, 10)}</td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/admin/parts/${p.id}/edit`}
                            className="text-[var(--brand)] hover:underline"
                          >
                            Edit
                          </Link>
                          {" · "}
                          <Link href={`/parts/${p.slug}`} className="text-zinc-400 hover:text-white hover:underline">
                            View
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
                  href={catalogPageHref(page - 1)}
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
                  href={catalogPageHref(page + 1)}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/5"
                >
                  Next
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "categories" ? <PartsCategoriesPanel categories={categoryRows} /> : null}

      {tab === "delivery" ? (
        <PartsDeliveryTemplatesPanel
          modes={deliveryModes}
          deliveryDefaults={deliveryDefaults}
          rowsByMode={deliveryRowsSerialized}
        />
      ) : null}
    </div>
  );
}
