import Link from "next/link";

import { ShipmentFlowVisual } from "@/components/shipping/shipment-flow-visual";
import { PageHeading } from "@/components/typography/page-headings";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { formatMoney } from "@/lib/format";
import { SHIPMENT_KIND_LABEL, SHIPMENT_STAGE_LABEL } from "@/lib/shipping/constants";
import { listShipmentsForUser } from "@/lib/shipping/shipment-service";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getSearchValue(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  const raw = typeof v === "string" ? v : Array.isArray(v) ? v[0] : "";
  return raw?.trim() ?? "";
}

export default async function DashboardShippingPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSessionOrRedirect("/dashboard/shipping");
  const sp = await searchParams;
  const query = getSearchValue(sp, "q");
  const rows = await listShipmentsForUser(session.user.id, query);

  return (
    <div>
      <PageHeading variant="dashboard">Shipping &amp; tracking</PageHeading>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Live progress for your parts and vehicle orders. Updates appear when operations posts new milestones.
      </p>
      <form className="mt-5 flex max-w-xl flex-wrap items-center gap-2" method="get">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search tracking #, order ref, car title, or part"
          className="h-10 min-w-[17rem] flex-1 rounded-xl border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[var(--brand)]/45 focus:outline-none dark:border-white/10 dark:bg-black/30"
        />
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-xl border border-border bg-muted px-3 text-sm text-foreground transition hover:bg-muted/80 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-200"
        >
          Search
        </button>
        {query ? (
          <a
            href="/dashboard/shipping"
            className="inline-flex h-10 items-center rounded-xl border border-border px-3 text-sm text-muted-foreground transition hover:text-foreground dark:border-white/10 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Clear
          </a>
        ) : null}
      </form>

      <div className="mt-10 space-y-5">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {query ? "No shipments matched your search." : "No active shipments yet. Completed orders will show milestones here."}
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
                  <Link href={`/dashboard/orders/${s.order.id}`} className="mt-2 inline-block text-xs font-medium text-[var(--brand)] hover:underline">
                    View order →
                  </Link>
                </div>
                <span className="rounded-full border border-border bg-muted px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground dark:border-white/10 dark:bg-black/40 dark:text-zinc-200">
                  {SHIPMENT_STAGE_LABEL[s.currentStage]}
                </span>
              </div>
              <div className="mt-5">
                <ShipmentFlowVisual currentStage={s.currentStage} compact />
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
    </div>
  );
}
