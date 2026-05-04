import Link from "next/link";
import { ArrowRight, Bell, MapPin, Package, Sparkles, Truck, Wallet } from "lucide-react";

import { DashboardOverviewRefresh } from "@/components/dashboard/dashboard-overview-refresh";
import { formatMoney } from "@/lib/format";
import type { DashboardIntelligence } from "@/lib/dashboard-intelligence";

type Props = { data: DashboardIntelligence };

function pfStateLabel(state: string): { label: string; tone: "ok" | "warn" | "bad" | "neutral" } {
  switch (state) {
    case "ACTIVE":
      return { label: "Active", tone: "ok" };
    case "INACTIVE":
      return { label: "Not activated", tone: "neutral" };
    case "EXPIRED":
      return { label: "Expired", tone: "bad" };
    case "PENDING_PAYMENT":
      return { label: "Payment pending", tone: "warn" };
    case "SUSPENDED":
      return { label: "Suspended", tone: "bad" };
    case "PENDING_APPROVAL":
      return { label: "Awaiting approval", tone: "warn" };
    case "UPSELL_ONLY":
      return { label: "Not a member", tone: "neutral" };
    default:
      return { label: state.replaceAll("_", " "), tone: "neutral" };
  }
}

function toneClass(t: "ok" | "warn" | "bad" | "neutral") {
  if (t === "ok")
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 dark:border-emerald-500/30";
  if (t === "warn")
    return "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 dark:border-amber-500/30";
  if (t === "bad")
    return "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200 dark:border-red-500/30";
  return "border-border bg-muted/50 text-foreground/90 dark:border-white/15 dark:bg-white/[0.06] dark:text-zinc-200";
}

function formatPfDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function DashboardIntelligenceView({ data }: Props) {
  const updated = new Date(data.generatedAt);
  const pf = pfStateLabel(data.partsFinder.state);
  const showPfExpiryRing =
    data.partsFinder.state === "ACTIVE" && data.partsFinder.daysRemaining != null;

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-[var(--brand)]/12 via-card to-muted/40 p-6 text-foreground shadow-sm dark:border-white/10 dark:from-[var(--brand)]/12 dark:via-zinc-900/50 dark:to-zinc-950 dark:shadow-none sm:p-8">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[var(--brand)]/20 blur-3xl opacity-90 dark:opacity-75"
          aria-hidden
        />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-cyan-500/15 blur-3xl dark:bg-cyan-500/10" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Welcome back, {data.displayName}
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Live updates and tracking of deliveries &amp; shipping, account balance, and Parts Finder access. Refresh
              any time to pull the latest from your account.
            </p>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Last built: {updated.toLocaleString()} (updates when you reload or use Refresh Page)
            </p>
          </div>
          <DashboardOverviewRefresh />
        </div>
      </header>

      {/* Key metrics — bento */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/parts"
          className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition hover:border-[var(--brand)]/40 dark:border-white/10 dark:bg-zinc-900/50 dark:shadow-none"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:text-sm">Wallet (GHS)</span>
            <Wallet className="size-4 text-[var(--brand)] opacity-90 dark:opacity-80" aria-hidden />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-foreground sm:text-4xl">{formatMoney(data.walletGhs, "GHS")}</p>
          <p className="mt-2 flex items-center gap-1 text-sm font-medium text-[var(--brand)] group-hover:underline">
            Top up in parts checkout <ArrowRight className="size-3.5" />
          </p>
        </Link>

        <Link
          href="/dashboard/shipping"
          className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition hover:border-cyan-500/40 dark:border-white/10 dark:bg-zinc-900/50 dark:shadow-none"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:text-sm">In-motion deliveries</span>
            <Truck className="size-4 text-cyan-600 dark:text-cyan-400/90" aria-hidden />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-foreground sm:text-4xl">{data.inMotionShipmentCount}</p>
          <p className="mt-2 text-sm text-muted-foreground">Shipments not yet completed or cancelled</p>
        </Link>

        <Link
          href="/dashboard/orders"
          className="group rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition hover:border-foreground/20 dark:border-white/10 dark:bg-zinc-900/50 dark:shadow-none"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:text-sm">Orders (all time)</span>
            <Package className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-foreground sm:text-4xl">{data.ordersTotal}</p>
          <p className="mt-2 text-sm text-muted-foreground">Vehicles and parts &amp; accessories</p>
        </Link>

        <Link
          href="/dashboard/notifications"
          className="group rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition hover:border-amber-500/35 dark:border-white/10 dark:bg-zinc-900/50 dark:shadow-none"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:text-sm">Notifications</span>
            <Bell className="size-4 text-amber-600 dark:text-amber-400/90" aria-hidden />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-foreground sm:text-4xl">{data.unreadNotifications}</p>
          <p className="mt-2 text-sm text-muted-foreground">Unread — tap to open inbox</p>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Parts Finder */}
        <div className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm dark:border-white/10 dark:bg-zinc-900/40 sm:p-6">
          <div className="flex items-center gap-2 text-[var(--brand)]">
            <Sparkles className="size-5" aria-hidden />
            <h2 className="text-base font-semibold tracking-wide text-foreground sm:text-lg">Parts Finder</h2>
          </div>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span
                className={`inline-flex rounded-lg border px-2.5 py-1.5 text-sm font-medium ${toneClass(pf.tone)}`}
              >
                {pf.label}
              </span>
              <dl className="mt-3 space-y-2 text-sm sm:text-base">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <dt className="text-muted-foreground">Activated</dt>
                  <dd className="min-w-0 text-right text-foreground">{formatPfDate(data.partsFinder.activeFrom)}</dd>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <dt className="text-muted-foreground">Access until (expiry)</dt>
                  <dd className="min-w-0 text-right text-foreground">{formatPfDate(data.partsFinder.activeUntil)}</dd>
                </div>
                {data.partsFinder.state === "ACTIVE" && data.partsFinder.daysRemaining != null ? (
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-border pt-2 dark:border-white/5">
                    <dt className="text-muted-foreground">Time left on activation</dt>
                    <dd className="font-semibold tabular-nums text-foreground">
                      {data.partsFinder.daysRemaining} day{data.partsFinder.daysRemaining === 1 ? "" : "s"}
                    </dd>
                  </div>
                ) : data.partsFinder.state === "PENDING_PAYMENT" ? (
                  <div className="border-t border-border pt-2 dark:border-white/5">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Payment pending — the dates above update once your payment is confirmed and access activates.
                    </p>
                  </div>
                ) : data.partsFinder.renewalRequired ? (
                  <p className="border-t border-border pt-2 text-sm leading-relaxed text-amber-800 dark:text-amber-200/90 dark:border-white/5">
                    Renew to continue using advanced search.
                  </p>
                ) : data.partsFinder.state !== "ACTIVE" && data.partsFinder.state !== "PENDING_PAYMENT" ? (
                  <p className="border-t border-border pt-2 text-sm text-muted-foreground dark:border-white/5">
                    Membership controls search and result access.
                  </p>
                ) : null}
              </dl>
            </div>
            {showPfExpiryRing && data.partsFinder.activeUntil ? (
              <div
                className="relative mx-auto h-20 w-20 sm:mx-0"
                title={`Access through ${new Date(data.partsFinder.activeUntil).toLocaleString()}`}
              >
                <div className="absolute inset-0 rounded-full border-4 border-border dark:border-white/10" />
                <div
                  className="absolute inset-0 rounded-full border-4 border-t-[var(--brand)] border-r-cyan-500/80 border-b-transparent border-l-transparent dark:border-r-cyan-400/80"
                  style={{
                    transform: "rotate(-45deg)",
                    opacity: Math.max(0.2, 1 - (data.partsFinder.daysRemaining ?? 0) / 45),
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-center text-sm font-bold text-foreground">
                  {data.partsFinder.daysRemaining}d
                </div>
              </div>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Searches (last 7 days): <span className="font-semibold text-foreground">{data.partsFinderSearches7d}</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/dashboard/parts-finder"
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-black"
            >
              Open dashboard
              <ArrowRight className="size-3.5" />
            </Link>
            <Link
              href="/parts-finder/search"
              className="rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted/50 dark:border-white/15"
            >
              New search
            </Link>
          </div>
        </div>

        {/* Secondary activity */}
        <div className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm dark:border-white/10 dark:bg-zinc-900/40 sm:p-6">
          <h2 className="text-base font-semibold text-foreground sm:text-lg">Activity &amp; saves</h2>
          <ul className="mt-4 space-y-3 text-sm text-foreground/90 sm:text-base">
            <li className="flex justify-between gap-2 border-b border-border pb-2 dark:border-white/5">
              <span className="text-muted-foreground">Cart (parts store)</span>
              <span className="font-medium tabular-nums text-foreground">{data.partsCartItemCount} line qty</span>
            </li>
            <li className="flex justify-between gap-2 border-b border-border pb-2 dark:border-white/5">
              <span className="text-muted-foreground">Saved vehicles</span>
              <Link href="/dashboard/favorites" className="font-medium text-[var(--brand)] hover:underline">
                {data.favoritesCount}
              </Link>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-muted-foreground">Successful payments</span>
              <Link href="/dashboard/payments" className="font-medium text-[var(--brand)] hover:underline">
                {data.successfulPaymentsCount}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Shipments strip */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground sm:text-lg">Delivery &amp; logistics</h2>
          <Link href="/dashboard/shipping" className="text-sm font-medium text-[var(--brand)] hover:underline">
            View all
          </Link>
        </div>
        {data.shipments.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground dark:bg-zinc-900/30">
            No shipment records yet. When you order cars or parts, operations updates will appear here.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.shipments.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/dashboard/orders/${s.orderId}`}
                  className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm transition hover:border-[var(--brand)]/40 dark:border-white/10 dark:bg-zinc-900/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-medium text-foreground sm:text-base">{s.headline}</p>
                    <MapPin className="size-4 shrink-0 text-cyan-600 dark:text-cyan-400/80" aria-hidden />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{s.kindLabel}</p>
                  <p className="mt-2 text-sm text-muted-foreground">Order {s.orderRef}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs sm:text-sm">
                    <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-foreground/90 dark:border-white/10 dark:bg-black/20">
                      {s.stageLabel}
                    </span>
                    {s.trackingNumber ? (
                      <span className="font-mono text-[10px] text-muted-foreground sm:text-xs">{s.trackingNumber}</span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground sm:text-xs">Updated {new Date(s.updatedAt).toLocaleString()}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent orders */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground sm:text-lg">Recent orders</h2>
          <Link href="/dashboard/orders" className="text-sm font-medium text-[var(--brand)] hover:underline">
            All orders
          </Link>
        </div>
        <div className="sda-table-scroll rounded-2xl border border-border bg-card text-card-foreground dark:border-white/10">
          <table className="w-full min-w-[520px] text-left text-sm sm:text-base">
            <thead className="border-b border-border bg-muted/40 text-xs font-medium uppercase text-muted-foreground dark:border-white/10 dark:bg-white/[0.06] sm:text-sm">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Placed</th>
                <th className="w-20 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-muted-foreground">
                    No orders yet.
                  </td>
                </tr>
              ) : (
                data.recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0 dark:border-white/5">
                    <td className="px-4 py-3 font-mono text-sm text-foreground/90">{o.reference}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.kind}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.orderStatus.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 text-foreground">{formatMoney(o.amount, o.currency)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(o.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/orders/${o.id}`} className="text-sm font-medium text-[var(--brand)] hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
