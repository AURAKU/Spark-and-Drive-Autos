import Link from "next/link";
import { Suspense } from "react";

import { GhanaPartsTrackingInfoButton } from "@/components/shipping/ghana-parts-tracking-info-button";
import { ShipmentFlowByKind } from "@/components/shipping/shipment-flow-by-kind";
import { ShippingPagination, ShippingTypeFilters } from "@/components/shipping/shipping-list-controls";
import { PageHeading } from "@/components/typography/page-headings";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { formatMoney } from "@/lib/format";
import { SHIPMENT_KIND_LABEL, SHIPMENT_STAGE_LABEL } from "@/lib/shipping/constants";
import { ghanaPartsCustomerStageLabel } from "@/lib/shipping/ghana-parts-flow";
import { listShipmentsForUser } from "@/lib/shipping/shipment-service";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getSearchValue(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  const raw = typeof v === "string" ? v : Array.isArray(v) ? v[0] : "";
  return raw?.trim() ?? "";
}

function parseIntPage(sp: Record<string, string | string[] | undefined>): number {
  const raw = getSearchValue(sp, "page");
  if (!raw) return 1;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function parseTypeFilter(sp: Record<string, string | string[] | undefined>): string {
  const t = getSearchValue(sp, "type").toLowerCase();
  if (t === "cars" || t === "car") return "cars";
  if (t === "parts" || t === "part" || t === "accessories") return "parts";
  return "all";
}

function buildClearSearchHref(typeFilter: string) {
  const p = new URLSearchParams();
  if (typeFilter !== "all") p.set("type", typeFilter);
  const qs = p.toString();
  return qs ? `/dashboard/shipping?${qs}` : "/dashboard/shipping";
}

export default async function DashboardShippingPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSessionOrRedirect("/dashboard/shipping");
  const sp = await searchParams;
  const query = getSearchValue(sp, "q");
  const typeFilter = parseTypeFilter(sp);
  const pageReq = parseIntPage(sp);
  const typeParam = typeFilter === "all" ? undefined : typeFilter;

  const { items: rows, total, page, totalPages } = await listShipmentsForUser(session.user.id, {
    q: query,
    type: typeParam,
    page: pageReq,
  });

  return (
    <div>
      <PageHeading variant="dashboard">Shipping &amp; Delivery Tracking</PageHeading>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        <span className="font-medium text-foreground/90">Shipping &amp; tracking</span>
        <span className="text-muted-foreground"> (Shipping &amp; Delivery Tracking)</span>
        {" — "}
        See delivery milestones for your cars and for parts &amp; accessories. Operations post updates as they move.
      </p>
      <div className="mt-4">
        <GhanaPartsTrackingInfoButton variant="customer" />
      </div>
      <div className="mt-5 flex max-w-3xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <form
          className="flex min-w-0 max-w-xl flex-1 flex-wrap items-center gap-2"
          method="get"
          action="/dashboard/shipping"
        >
          {typeFilter !== "all" ? <input type="hidden" name="type" value={typeFilter} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search tracking #, order ref, car title, or part"
            className="h-10 min-w-[12rem] flex-1 rounded-xl border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[var(--brand)]/45 focus:outline-none dark:border-white/10 dark:bg-black/30"
          />
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-xl border border-border bg-muted px-3 text-sm text-foreground transition hover:bg-muted/80 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-200"
          >
            Search
          </button>
        </form>
        <Suspense
          fallback={
            <div className="h-9 min-w-[200px] animate-pulse rounded-xl border border-border bg-muted/30 dark:border-white/10" />
          }
        >
          <ShippingTypeFilters />
        </Suspense>
      </div>
      {query ? (
        <p className="mt-2 text-xs">
          <a href={buildClearSearchHref(typeFilter)} className="text-[var(--brand)] hover:underline">
            Clear search
          </a>
        </p>
      ) : null}

      <div className="mt-8 space-y-5">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {query
              ? "No shipments matched your search or filter."
              : "No active shipments yet. Completed orders will show milestones here."}
          </p>
        ) : (
          rows.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-md ring-1 ring-border/50 dark:border-white/10 dark:bg-gradient-to-br dark:from-[#0c1420] dark:to-black/50 dark:shadow-[0_0_50px_-28px_rgba(49,182,199,0.25)] dark:ring-white/[0.06]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{s.order.reference}</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {SHIPMENT_KIND_LABEL[s.kind] ?? s.kind}
                    {s.order.kind === "CAR" && s.order.car?.title ? (
                      <span className="text-muted-foreground"> · {s.order.car.title}</span>
                    ) : null}
                  </p>
                  <Link
                    href={`/dashboard/orders/${s.order.id}`}
                    className="mt-2 inline-block text-xs font-medium text-[var(--brand)] hover:underline"
                  >
                    View order →
                  </Link>
                </div>
                <span className="rounded-full border border-border bg-muted px-3 py-1 text-[10px] font-semibold tracking-wide text-foreground dark:border-white/10 dark:bg-black/40 dark:text-zinc-200">
                  {s.kind === "PARTS_GHANA"
                    ? ghanaPartsCustomerStageLabel(s.currentStage)
                    : SHIPMENT_STAGE_LABEL[s.currentStage]}
                </span>
              </div>
              <div className="mt-5">
                <ShipmentFlowByKind kind={s.kind} currentStage={s.currentStage} compact />
              </div>
              <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                {s.trackingNumber ? (
                  <div>
                    <dt className="text-muted-foreground">Tracking #</dt>
                    <dd className="font-mono font-medium text-foreground">{s.trackingNumber}</dd>
                  </div>
                ) : null}
                {s.carrier ? (
                  <div>
                    <dt className="text-muted-foreground">Carrier</dt>
                    <dd className="font-medium text-foreground">{s.carrier}</dd>
                  </div>
                ) : null}
                {s.feeAmount != null && Number(s.feeAmount) > 0 ? (
                  <div>
                    <dt className="text-muted-foreground">Fee</dt>
                    <dd className="font-medium text-foreground">{formatMoney(Number(s.feeAmount), s.feeCurrency)}</dd>
                  </div>
                ) : null}
                {s.estimatedDuration ? (
                  <div>
                    <dt className="text-muted-foreground">ETA</dt>
                    <dd className="font-medium text-foreground">{s.estimatedDuration}</dd>
                  </div>
                ) : null}
              </dl>
              {s.events.length > 0 ? (
                <ul className="mt-4 space-y-2 border-t border-border pt-4 text-xs dark:border-white/5">
                  {s.events.slice(-6).map((ev) => (
                    <li key={ev.id}>
                      <span className="text-muted-foreground">{new Date(ev.createdAt).toLocaleDateString()}</span> ·{" "}
                      <span className="text-foreground">{ev.title}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))
        )}
      </div>
      <Suspense fallback={null}>
        <ShippingPagination page={page} totalPages={totalPages} total={total} />
      </Suspense>
    </div>
  );
}
