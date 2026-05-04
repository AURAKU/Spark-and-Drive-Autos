import { Suspense } from "react";

import { AdminPartsDeliveryTemplatesSection } from "@/components/admin/admin-parts-delivery-templates-section";
import { ShippingHubClient, type AdminShipmentRow } from "@/components/admin/shipping-hub-client";
import { GhanaPartsTrackingInfoButton } from "@/components/shipping/ghana-parts-tracking-info-button";
import { PageHeading } from "@/components/typography/page-headings";
import { AdminOperationsDateFilter } from "@/components/admin/admin-operations-date-filter";
import {
  ADMIN_SHIPPING_SEGMENTS,
  type AdminShippingSegment,
  countShipmentsForAdminDashboard,
  listShipmentsForAdminDashboard,
} from "@/lib/shipping/shipment-service";
import { appendOpsDateParams, parseOpsDateFromSearchParams } from "@/lib/admin-operations-date-filter";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getSearchValue(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  const raw = typeof v === "string" ? v : Array.isArray(v) ? v[0] : "";
  return raw?.trim() ?? "";
}

const SEGMENT_LABELS: Record<AdminShippingSegment, string> = {
  all: "All",
  parts_ghana: "Parts · Ghana stock",
  parts_china: "Parts · China stock",
  cars_ghana: "Cars · Ghana",
  cars_china: "Cars · China / in transit",
};

function parseAdminShippingSegment(raw: string | undefined): AdminShippingSegment {
  if (
    raw === "parts_ghana" ||
    raw === "parts_china" ||
    raw === "cars_ghana" ||
    raw === "cars_china"
  ) {
    return raw;
  }
  return "all";
}

function mapRow(s: Awaited<ReturnType<typeof listShipmentsForAdminDashboard>>[number]): AdminShipmentRow {
  const o = s.order;
  const partSummary =
    o.kind === "PARTS"
      ? `${o.partItems.length} part line${o.partItems.length === 1 ? "" : "s"}`
      : o.car?.title ?? "Vehicle";
  return {
    id: s.id,
    orderId: o.id,
    reference: o.reference,
    orderKind: o.kind,
    kind: s.kind,
    currentStage: s.currentStage,
    deliveryMode: s.deliveryMode,
    customerQuotedPartsDelivery: o.partsCustomerQuotedDeliveryLabel?.trim() || null,
    feeAmount: s.feeAmount != null ? Number(s.feeAmount) : null,
    estimatedDuration: s.estimatedDuration,
    trackingNumber: s.trackingNumber,
    carrier: s.carrier,
    internalNotes: s.internalNotes,
    userEmail: o.user?.email ?? null,
    carTitle: o.car?.title ?? null,
    partSummary,
    events: s.events.map((e) => ({
      id: e.id,
      stage: e.stage,
      title: e.title,
      description: e.description,
      createdAt: e.createdAt.toISOString(),
      visibleToCustomer: e.visibleToCustomer,
    })),
  };
}

export default async function AdminShippingPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const ops = parseOpsDateFromSearchParams(sp);
  const query = getSearchValue(sp, "q");
  const segment = parseAdminShippingSegment(getSearchValue(sp, "segment"));
  const orderCreatedRange = ops.range;

  const [shipments, segmentCounts] = await Promise.all([
    listShipmentsForAdminDashboard(100, query, segment, orderCreatedRange),
    countShipmentsForAdminDashboard(query, orderCreatedRange),
  ]);

  const rows = shipments.map(mapRow);

  const buildShippingHref = (nextSegment: AdminShippingSegment, opts?: { clearQuery?: boolean }) => {
    const params = new URLSearchParams();
    appendOpsDateParams(params, sp);
    const q = opts?.clearQuery ? "" : query;
    if (q) params.set("q", q);
    if (nextSegment !== "all") params.set("segment", nextSegment);
    const qs = params.toString();
    return qs ? `/admin/shipping?${qs}` : "/admin/shipping";
  };

  const segmentNav = ADMIN_SHIPPING_SEGMENTS.map((s) => ({
    segment: s,
    label: SEGMENT_LABELS[s],
    count: segmentCounts[s],
    href: buildShippingHref(s),
    active: segment === s,
  }));

  const intelParams = new URLSearchParams();
  appendOpsDateParams(intelParams, sp);
  const intelQs = intelParams.toString();
  const paymentsIntelHref = intelQs ? `/admin/payments/intelligence?${intelQs}` : "/admin/payments/intelligence";
  const shippingBaseHref = intelQs ? `/admin/shipping?${intelQs}` : "/admin/shipping";

  return (
    <div className="space-y-8 pb-16">
      <Suspense fallback={<div className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[0.02]" />}>
        <AdminOperationsDateFilter />
      </Suspense>

      <div className="overflow-hidden rounded-3xl border border-cyan-500/15 bg-gradient-to-br from-[#061018] via-[#0a0f18] to-[#120c18] shadow-[0_0_0_1px_rgba(34,211,238,0.06),0_28px_90px_-36px_rgba(34,211,238,0.22)]">
        <div className="border-b border-white/[0.06] px-5 py-5 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-400/90">Logistics operations</p>
          <PageHeading variant="dashboard" className="mt-1 sm:text-3xl">
            Shipping &amp; fulfilment
          </PageHeading>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Flow-based tracking for parts &amp; accessories (Ghana stock vs China stock) and cars (Ghana vs China / in
            transit). The calendar uses <span className="text-zinc-200">order created</span> time — match it with payment
            intelligence for one timeline.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <a
              href={paymentsIntelHref}
              className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-[var(--brand)]/40 hover:bg-[var(--brand)]/10"
            >
              Payment intelligence
              <span aria-hidden>→</span>
            </a>
            <GhanaPartsTrackingInfoButton variant="admin" className="!max-w-none border-white/12 bg-white/[0.04] text-zinc-200 hover:border-[var(--brand)]/40 hover:bg-[var(--brand)]/10" />
          </div>
          <form className="mt-4 flex max-w-xl flex-wrap items-center gap-2" method="get">
            {typeof sp.opsDateMode === "string" ? <input type="hidden" name="opsDateMode" value={sp.opsDateMode} /> : null}
            {typeof sp.opsDateDay === "string" ? <input type="hidden" name="opsDateDay" value={sp.opsDateDay} /> : null}
            {typeof sp.opsDateMonth === "string" ? <input type="hidden" name="opsDateMonth" value={sp.opsDateMonth} /> : null}
            {typeof sp.opsDateYear === "string" ? <input type="hidden" name="opsDateYear" value={sp.opsDateYear} /> : null}
            {segment !== "all" ? <input type="hidden" name="segment" value={segment} /> : null}
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search tracking #, order ref, car title, part, or carrier"
              className="h-10 min-w-[18rem] flex-1 rounded-xl border border-white/12 bg-black/35 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[var(--brand)]/45 focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-xl border border-white/12 bg-white/[0.06] px-3 text-sm text-zinc-200 transition hover:border-[var(--brand)]/40 hover:bg-[var(--brand)]/10"
            >
              Search
            </button>
            {query ? (
              <a
                href={shippingBaseHref}
                className="inline-flex h-10 items-center rounded-xl border border-white/12 px-3 text-sm text-zinc-400 transition hover:text-zinc-200"
              >
                Clear
              </a>
            ) : null}
          </form>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/[0.02]" />
        }
      >
        <AdminPartsDeliveryTemplatesSection context="shipping" />
      </Suspense>

      <ShippingHubClient rows={rows} paymentsIntelHref={paymentsIntelHref} segmentNav={segmentNav} />
    </div>
  );
}
