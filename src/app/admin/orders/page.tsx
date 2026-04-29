import Link from "next/link";
import { Suspense } from "react";

import { AdminOperationsDateFilter } from "@/components/admin/admin-operations-date-filter";
import { AdminOrdersExportButtons } from "@/components/admin/admin-orders-export-buttons";
import { AdminOrdersRefreshButton } from "@/components/admin/admin-orders-refresh-button";
import { AdminOrdersSearchForm } from "@/components/admin/admin-orders-search-form";
import { PageHeading } from "@/components/typography/page-headings";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { orderPartsLineageLabel, type AdminPartsLineage, wherePartsLineageForAdminList } from "@/lib/admin-orders-parts-filter";
import { formatMoney } from "@/lib/format";
import { normalizeIntelListPage } from "@/lib/ops";
import { prisma } from "@/lib/prisma";

import type { OrderKind, Prisma } from "@prisma/client";

import { appendOpsDateParams, parseOpsDateFromSearchParams } from "@/lib/admin-operations-date-filter";
import { buildOrderListSearchWhere, normalizeOrderListSearchQuery } from "@/lib/admin-orders-search";
import { orderItemTitleSummary } from "@/lib/order-item-display";

export const dynamic = "force-dynamic";

function formatOrderActivityLine(d: Date) {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const PAGE_SIZE = 15;

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
  const rows = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      reference: true,
      kind: true,
      orderStatus: true,
      amount: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { email: true } },
      car: { select: { slug: true, title: true, sourceType: true } },
      partItems: { select: { titleSnapshot: true, origin: true, part: { select: { stockStatus: true } } } },
      payments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
    },
  });
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

  const lineageWhere =
    !kindFilter || kindFilter === "PARTS" ? wherePartsLineageForAdminList(partsLineage) : undefined;
  const whereParts: Prisma.OrderWhereInput[] = [];
  if (kindFilter) whereParts.push({ kind: kindFilter });
  if (ops.range) {
    whereParts.push({ createdAt: { gte: ops.range.gte, lt: ops.range.lt } });
  }
  if (lineageWhere) whereParts.push(lineageWhere);
  if (searchWhere) whereParts.push(searchWhere);
  const where: Prisma.OrderWhereInput = whereParts.length > 0 ? { AND: whereParts } : {};
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
          <Suspense fallback={<span className="text-xs text-muted-foreground">Export…</span>}>
            <AdminOrdersExportButtons />
          </Suspense>
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

      <div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-card/50 shadow-sm ring-1 ring-border/40">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs font-medium tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3 w-[1%]">Parts</th>
              <th className="px-4 py-3 w-[1%]">Status</th>
              <th className="px-4 py-3 min-w-[11rem]">Customer</th>
              <th className="px-4 py-3 w-[1%] whitespace-nowrap">Amount</th>
              <th className="px-4 py-3 min-w-[8.5rem]">Placed &amp; updated</th>
              <th className="px-4 py-3 w-[1%]" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  {searchQ ? "No orders match this search. Try a different term or clear the search." : "No orders yet."}
                </td>
              </tr>
            ) : (
              rows.map((o) => {
                const updatedDiffers =
                  o.updatedAt.getTime() !== o.createdAt.getTime();
                return (
                  <tr
                    key={o.id}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/40 dark:hover:bg-white/[0.04]"
                  >
                    <td className="px-4 py-3.5 font-mono text-xs text-foreground/90 align-top">{o.reference}</td>
                    <td className="max-w-[min(20rem,32vw)] px-4 py-3.5 align-top text-foreground/90">
                      {o.kind === "CAR" && o.car ? (
                        <Link className="text-[var(--brand)] hover:underline" href={`/cars/${o.car.slug}`}>
                          {orderItemTitleSummary(o)}
                        </Link>
                      ) : (
                        <span className="line-clamp-2">{orderItemTitleSummary(o)}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted-foreground align-top">
                      {o.kind === "PARTS" ? orderPartsLineageLabel(o) : "—"}
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      {o.payments[0] ? (
                        <PaymentStatusBadge status={o.payments[0].status} />
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 break-all text-sm text-muted-foreground align-top" title={o.user?.email ?? ""}>
                      {o.user?.email ?? "—"}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--brand)] font-medium tabular-nums whitespace-nowrap align-top">
                      {formatMoney(Number(o.amount), o.currency)}
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <div className="flex flex-col gap-1.5 text-xs leading-snug">
                        <div>
                          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Placed</p>
                          <p className="text-foreground tabular-nums">{formatOrderActivityLine(o.createdAt)}</p>
                        </div>
                        {updatedDiffers ? (
                          <div>
                            <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Updated</p>
                            <p className="text-foreground/85 tabular-nums">{formatOrderActivityLine(o.updatedAt)}</p>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right align-top">
                      <Link
                        className="inline-flex text-sm font-medium text-[var(--brand)] hover:underline"
                        href={`/admin/orders/${o.id}`}
                      >
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
