import Link from "next/link";
import { Suspense } from "react";

import { applyChinaPreOrderIntlFormAction } from "@/actions/parts-admin";
import { AdminPartsDeliveryTemplatesSection } from "@/components/admin/admin-parts-delivery-templates-section";
import { AddPartDialog } from "@/components/admin/add-part-dialog";
import { PageHeading } from "@/components/typography/page-headings";
import { PartsCategoriesPanel } from "@/components/admin/parts-categories-delivery-panel";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { formatConverted } from "@/lib/currency";
import { GHANA_LOW_STOCK_ALERT_MAX, getGhanaLowStockPartsForAdmin } from "@/lib/ghana-low-stock";
import { normalizeIntelListPage } from "@/lib/ops";
import { prisma } from "@/lib/prisma";

import { PartOrigin, PartStockStatus, PartListingState } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TAB_VALUES = ["catalog", "categories", "delivery"] as const;
type Tab = (typeof TAB_VALUES)[number];

function parseTab(raw: string | undefined): Tab {
  if (raw && TAB_VALUES.includes(raw as Tab)) return raw as Tab;
  return "catalog";
}

export default async function PartsManagementPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const tab = parseTab(typeof sp.tab === "string" ? sp.tab : undefined);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const category = typeof sp.category === "string" ? sp.category.trim() : "";
  const state =
    typeof sp.state === "string" && Object.values(PartListingState).includes(sp.state as PartListingState)
      ? (sp.state as PartListingState)
      : "";
  const pageReqRaw = parseInt(typeof sp.page === "string" ? sp.page : "1", 10);
  const pageReq = normalizeIntelListPage(Number.isFinite(pageReqRaw) ? pageReqRaw : undefined);
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

  let categoriesForFilter: { category: string }[] = [];
  let categoriesAll: Awaited<ReturnType<typeof prisma.partCategory.findMany>> = [];
  let totalParts = 0;
  let parts: Awaited<ReturnType<typeof prisma.part.findMany>> = [];
  let ghanaLowStockParts: Awaited<ReturnType<typeof getGhanaLowStockPartsForAdmin>> = [];
  let totalPages = 1;
  let page = 1;
  let adminPartsError: string | null = null;

  try {
    const [cf, ca, tp] = await Promise.all([
      prisma.part.findMany({
        select: { category: true },
        distinct: ["category"],
        orderBy: { category: "asc" },
      }),
      prisma.partCategory.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.part.count({ where }),
    ]);
    categoriesForFilter = cf;
    categoriesAll = ca;
    totalParts = tp;

    totalPages = Math.max(1, Math.ceil(Math.max(0, totalParts) / PAGE_SIZE));
    page = Math.min(Math.max(1, pageReq), totalPages);

    parts =
      tab === "catalog"
        ? await prisma.part.findMany({
            where,
            orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
          })
        : [];

    ghanaLowStockParts = await getGhanaLowStockPartsForAdmin();
  } catch (e) {
    console.error("[admin/parts] load failed", e);
    adminPartsError =
      "Parts data could not be loaded. If this persists, run prisma migrate deploy on the server (PartCategory / Part.origin / basePriceRmb must exist) and verify DATABASE_URL.";
    totalParts = 0;
    parts = [];
    ghanaLowStockParts = [];
    categoriesForFilter = [];
    categoriesAll = [];
    totalPages = 1;
    page = 1;
  }

  const categoriesSelect = categoriesAll.filter((c) => c.active);

  const categoryRows = categoriesAll.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    active: c.active,
  }));
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

  const catalogPageHrefs =
    tab === "catalog" && totalPages > 1
      ? Array.from({ length: totalPages }, (_, i) => catalogPageHref(i + 1))
      : undefined;

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

      {adminPartsError ? (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
          {adminPartsError}
        </div>
      ) : null}

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
            {adminPartsError
              ? "Catalog totals unavailable until the database responds."
              : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalParts)} of ${totalParts} SKUs`}
          </p>

          <div className="mt-4 sda-table-scroll rounded-2xl border border-white/10">
            <table className="min-w-[780px] w-full border-collapse text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.04] text-xs text-zinc-500 uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">RMB</th>
                  <th className="px-4 py-3 font-medium">GHS (saved)</th>
                  <th className="px-4 py-3 font-medium">Origin</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminPartsError ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-zinc-500">
                      Fix the database connection or migrations, then refresh. Categories and delivery tabs may also fail until
                      the schema matches.
                    </td>
                  </tr>
                ) : parts.length === 0 ? (
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
                    const isChinaListedPreorder =
                      p.origin === PartOrigin.CHINA && p.stockStatus === PartStockStatus.ON_REQUEST;
                    return (
                      <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="px-4 py-3 text-zinc-300 tabular-nums">
                          {isChinaListedPreorder ? (
                            <span>
                              {p.stockQty} · <span className="text-amber-200/90">China pre-order</span>
                            </span>
                          ) : (
                            p.stockQty
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{p.title}</div>
                          <div className="font-mono text-xs text-zinc-500">{p.slug}</div>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">{p.category}</td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-300">
                          {Number(p.basePriceRmb).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">{formatConverted(Number(p.priceGhs), "GHS")}</td>
                        <td className="px-4 py-3 text-zinc-400">{p.origin}</td>
                        <td className="px-4 py-3 text-zinc-500">{p.updatedAt.toISOString().slice(0, 10)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end gap-1.5">
                            {isChinaListedPreorder ? (
                              <form action={applyChinaPreOrderIntlFormAction}>
                                <input type="hidden" name="partId" value={p.id} />
                                <button
                                  type="submit"
                                  className="text-xs font-medium text-amber-200/95 hover:underline"
                                  title="Link sea + both air delivery templates so customers can pay intl after checkout"
                                >
                                  Apply intl options
                                </button>
                              </form>
                            ) : null}
                            <div>
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
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalParts > 0 ? (
            <ListPaginationFooter
              className="border-border/50 dark:border-white/5"
              page={page}
              totalPages={totalPages}
              totalItems={totalParts}
              pageSize={PAGE_SIZE}
              itemLabel="SKUs"
              prevHref={page > 1 ? catalogPageHref(page - 1) : null}
              nextHref={page < totalPages ? catalogPageHref(page + 1) : null}
              pageHrefs={catalogPageHrefs}
            />
          ) : null}
        </div>
      ) : null}

      {tab === "categories" ? <PartsCategoriesPanel categories={categoryRows} /> : null}

      {tab === "delivery" ? (
        <Suspense
          fallback={
            <div className="mt-6 h-48 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
          }
        >
          <AdminPartsDeliveryTemplatesSection context="parts" />
        </Suspense>
      ) : null}
    </div>
  );
}
