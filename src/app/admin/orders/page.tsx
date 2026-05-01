import Link from "next/link";
import { Suspense } from "react";

import { AdminOperationsDateFilter } from "@/components/admin/admin-operations-date-filter";
import { AdminOrdersInteractive } from "@/components/admin/admin-orders-interactive";
import { AdminOrdersRefreshButton } from "@/components/admin/admin-orders-refresh-button";
import { AdminOrdersSearchForm } from "@/components/admin/admin-orders-search-form";
import { PageHeading } from "@/components/typography/page-headings";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { type AdminPartsLineage } from "@/lib/admin-orders-parts-filter";
import {
  ADMIN_ORDERS_PAGE_SIZE,
  buildAdminOrdersBaseWhere,
  fetchAdminOrdersRich,
} from "@/lib/admin-orders-export-query";
import { buildAdminOrderListRow } from "@/lib/admin-orders-list-serialize";
import { getGlobalCurrencySettings } from "@/lib/currency";
import { normalizeIntelListPage } from "@/lib/ops";
import { prisma } from "@/lib/prisma";

import type { OrderKind, Prisma } from "@prisma/client";

import { appendOpsDateParams, parseOpsDateFromSearchParams } from "@/lib/admin-operations-date-filter";
import { buildOrderListSearchWhere, normalizeOrderListSearchQuery } from "@/lib/admin-orders-search";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const PAGE_SIZE = ADMIN_ORDERS_PAGE_SIZE;

function readPage(sp: Record<string, string | string[] | undefined>, key: string): number {
  const v = sp[key];
  const s = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  if (s == null || s === "") return 1;
  const n = parseInt(s, 10);
  return normalizeIntelListPage(Number.isFinite(n) ? n : undefined);
}

async function loadAdminOrdersPageData(where: Prisma.OrderWhereInput, pageReq: number) {
  const total = await prisma.order.count({ where });
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / PAGE_SIZE));
  const page = Math.min(Math.max(1, pageReq), totalPages);
  const settings = await getGlobalCurrencySettings();
  const richRows = await fetchAdminOrdersRich(where, {
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const rows = richRows.map((r) => buildAdminOrderListRow(r, settings));
  return { total, totalPages, page, rows };
}

export default async function AdminOrdersPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const kindRaw = typeof sp.kind === "string" ? sp.kind : "";
  const kindFilter: OrderKind | null =
    kindRaw === "CAR" || kindRaw === "PARTS" ? (kindRaw as OrderKind) : null;
  const partsLineageRaw = typeof sp.partsLineage === "string" ? sp.partsLineage : "";
  const partsLineage: AdminPartsLineage =
    partsLineageRaw === "ghana" || partsLineageRaw === "china_preorder" ? (partsLineageRaw as AdminPartsLineage) : null;

  const ops = parseOpsDateFromSearchParams(sp);
  const pageReq = readPage(sp, "page");
  const searchQ = normalizeOrderListSearchQuery(sp.q);
  const searchWhere = buildOrderListSearchWhere(searchQ);

  const where = buildAdminOrdersBaseWhere(kindFilter, ops.range, partsLineage, searchWhere);
  const { total, totalPages, page, rows } = await loadAdminOrdersPageData(where, pageReq);

  const buildHref = (kind: "" | "CAR" | "PARTS", nextPage = 1, pl: AdminPartsLineage = null) => {
    const p = new URLSearchParams();
    if (kind) p.set("kind", kind);
    if (nextPage > 1) p.set("page", String(nextPage));
    if (pl === "ghana" || pl === "china_preorder") p.set("partsLineage", pl);
    appendOpsDateParams(p, sp);
    if (searchQ) p.set("q", searchQ);
    const qs = p.toString();
    return qs ? `/admin/orders?${qs}` : "/admin/orders";
  };

  return (
    <div className="space-y-6">
      <Suspense
        fallback={
          <div className="h-24 animate-pulse rounded-2xl border border-border bg-muted/40 dark:bg-white/[0.02]" />
        }
      >
        <AdminOperationsDateFilter />
      </Suspense>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <PageHeading variant="dashboard">All Orders</PageHeading>
          <p className="mt-2 text-sm text-muted-foreground">Latest purchase and reservation records.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminOrdersRefreshButton />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <Suspense
          fallback={
            <div className="h-10 w-full max-w-xl animate-pulse rounded-lg border border-border bg-muted/50" />
          }
        >
          <AdminOrdersSearchForm initialQuery={searchQ} />
        </Suspense>
        {searchQ ? (
          <p className="text-xs text-muted-foreground sm:pb-0.5">
            Filtering by &quot;{searchQ.length > 64 ? `${searchQ.slice(0, 64)}…` : searchQ}&quot;
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={buildHref("", 1)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            !kindFilter && !partsLineage
              ? "bg-[var(--brand)] text-black"
              : "border border-border text-muted-foreground hover:bg-muted/60"
          }`}
        >
          All
        </Link>
        <Link
          href={buildHref("CAR", 1)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            kindFilter === "CAR"
              ? "bg-[var(--brand)] text-black"
              : "border border-border text-muted-foreground hover:bg-muted/60"
          }`}
        >
          Cars Inventory
        </Link>
        <Link
          href={buildHref("PARTS", 1)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            kindFilter === "PARTS" || partsLineage != null
              ? "bg-[var(--brand)] text-black"
              : "border border-border text-muted-foreground hover:bg-muted/60"
          }`}
        >
          Parts &amp; Accessories
        </Link>
      </div>

      {(!kindFilter || kindFilter === "PARTS") && (
        <div className="mt-3 flex flex-wrap items-center gap-2 pl-0 text-xs text-muted-foreground">
          <span className="w-full sm:w-auto">Parts origin:</span>
          <Link
            href={buildHref(kindFilter ?? "PARTS", 1, null)}
            className={`rounded-md px-2.5 py-1 font-medium ${
              !partsLineage ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All parts
          </Link>
          <Link
            href={buildHref("PARTS", 1, "ghana")}
            className={`rounded-md px-2.5 py-1 font-medium ${
              partsLineage === "ghana"
                ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Ghana listed only
          </Link>
          <Link
            href={buildHref("PARTS", 1, "china_preorder")}
            className={`rounded-md px-2.5 py-1 font-medium ${
              partsLineage === "china_preorder"
                ? "bg-amber-500/15 text-amber-900 dark:text-amber-200"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            China pre-orders
          </Link>
        </div>
      )}

      <Suspense
        fallback={
          <div className="mt-8 h-64 animate-pulse rounded-2xl border border-border bg-muted/30 dark:bg-white/[0.02]" />
        }
      >
        <AdminOrdersInteractive
          rows={rows}
          emptyHint={
            total === 0
              ? searchQ
                ? "No orders match this search. Try a different term or clear the search."
                : "No orders yet."
              : undefined
          }
        />
      </Suspense>
      {total > 0 ? (
        <ListPaginationFooter
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          itemLabel="Orders"
          prevHref={page > 1 ? buildHref(kindFilter ?? "", page - 1, partsLineage) : null}
          nextHref={page < totalPages ? buildHref(kindFilter ?? "", page + 1, partsLineage) : null}
          pageHrefs={
            totalPages > 1
              ? Array.from({ length: totalPages }, (_, i) => buildHref(kindFilter ?? "", i + 1, partsLineage))
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
