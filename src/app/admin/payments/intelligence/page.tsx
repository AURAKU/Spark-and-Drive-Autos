import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  Banknote,
  CreditCard,
  Package,
  Ship,
  TrendingUp,
  Wallet,
  Wrench,
} from "lucide-react";

import { IntelActionProofPeek } from "@/components/admin/intel-action-proof-peek";
import { AdminPaymentIntelligenceCharts } from "@/components/admin/admin-payment-intelligence-charts";
import { PageHeading } from "@/components/typography/page-headings";
import { AdminOperationsDateFilter } from "@/components/admin/admin-operations-date-filter";
import { AdminPaymentsExportButtons } from "@/components/admin/admin-payments-export-buttons";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { formatIntelMoneyFromGhs, formatIntelPaymentAmount } from "@/lib/admin-intel-money";
import { appendOpsDateParams } from "@/lib/admin-operations-date-filter";
import { buildPaymentIntelligenceFilters } from "@/lib/admin-payment-intelligence-filters";
import { formatDate } from "@/lib/format";
import { getGlobalCurrencySettings, parseDisplayCurrency } from "@/lib/currency";
import {
  amountToGhs,
  splitInventoryProfitForSuccessPayments,
  sumInventoryProfitForSuccessPayments,
} from "@/lib/inventory-profit";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import {
  decimalLikeToNumber,
  fetchPaymentIntelligenceAggregateDataCached,
  normalizeIntelListPage,
} from "@/lib/ops";
import { SETTLEMENT_METHOD_ORDER, settlementMethodLabel } from "@/lib/payment-settlement";
import { PAYMENT_STATUS_ORDER } from "@/lib/payment-status-utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readListPageParam(sp: Record<string, string | string[] | undefined>, key: string): number {
  const v = sp[key];
  const s = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  if (s == null || s === "") return 1;
  const n = parseInt(s, 10);
  return normalizeIntelListPage(Number.isFinite(n) ? n : undefined);
}

export default async function PaymentIntelligencePage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const {
    methodFilter,
    statusFilter,
    orderKindFilter,
    q,
    period,
    ops,
    basePaymentWhere,
    basePaymentWhereSansOrderKind,
    walletWhere,
  } = buildPaymentIntelligenceFilters(sp);

  const paymentsPageReq = readListPageParam(sp, "paymentsPage");
  const walletPageReq = readListPageParam(sp, "walletPage");
  const actionPageReq = readListPageParam(sp, "actionPage");

  const displayCurrency = parseDisplayCurrency(typeof sp.displayCurrency === "string" ? sp.displayCurrency : undefined);
  const fxSettings = await getGlobalCurrencySettings();
  const fx = { usdToRmb: fxSettings.usdToRmb, rmbToGhs: fxSettings.rmbToGhs, usdToGhs: fxSettings.usdToGhs };

  const {
    totals,
    successCount,
    failedCount,
    pendingCount,
    disputedCount,
    awaitingProofCount,
    successValueAgg,
    failedValueAgg,
    refundedValueAgg,
    byStatus,
    byMethod,
    pendingProofReview,
    awaitingProofNoUpload,
    attention,
    rows,
    walletRows,
    walletCreditAgg,
    walletDebitAgg,
    walletPendingCount,
    partsSalesFromWalletAgg,
    profitPayments,
    partsFinderActivationPayments,
    listMeta,
  } = await fetchPaymentIntelligenceAggregateDataCached({
    basePaymentWhere,
    basePaymentWhereSansOrderKind,
    walletWhere,
    paymentsPage: paymentsPageReq,
    walletPage: walletPageReq,
    actionPage: actionPageReq,
  });

  const successValue = decimalLikeToNumber(successValueAgg._sum.amount);
  const failedValue = decimalLikeToNumber(failedValueAgg._sum.amount);
  const refundedValue = decimalLikeToNumber(refundedValueAgg._sum.amount);
  const walletCredits = decimalLikeToNumber(walletCreditAgg._sum.amount);
  const walletDebits = decimalLikeToNumber(walletDebitAgg._sum.amount);
  const partsSalesFromWallet = decimalLikeToNumber(partsSalesFromWalletAgg._sum.amount);
  const conversionRate = totals > 0 ? (successCount / totals) * 100 : 0;
  const grossSales = successValue + partsSalesFromWallet;
  const netWalletFlow = walletCredits - walletDebits;

  const profitIntel = sumInventoryProfitForSuccessPayments(profitPayments, fx);
  const profitSplit = splitInventoryProfitForSuccessPayments(profitPayments, fx);
  const partsFinderActivationRevenueGhs = partsFinderActivationPayments.reduce(
    (s, p) => s + amountToGhs(Number(p.amount), p.currency, fx),
    0,
  );
  const partsFinderActivationCount = partsFinderActivationPayments.length;
  /** No inventory COGS — activation / renewal is treated as pure margin for reporting. */
  const partsFinderActivationProfitGhs = partsFinderActivationRevenueGhs;
  const totalProfitEstGhs = profitIntel.profitGhs + partsFinderActivationProfitGhs;
  const totalRevenueEstGhs = profitIntel.revenueGhs + partsFinderActivationRevenueGhs;

  const buildHref = (next: {
    method?: string | null;
    status?: string | null;
    period?: typeof period;
    q?: string | null;
    displayCurrency?: "GHS" | "USD" | "CNY" | null;
    orderKind?: "CAR" | "PARTS" | "" | null;
    /** When true, list pages reset to 1 (use on filter / period / search changes). */
    resetListPages?: boolean;
    paymentsPage?: number;
    walletPage?: number;
    actionPage?: number;
  }) => {
    const params = new URLSearchParams();
    const method = next.method !== undefined ? next.method : methodFilter ?? null;
    const status = next.status !== undefined ? next.status : statusFilter ?? null;
    const search = next.q !== undefined ? next.q : q;
    const activePeriod = next.period ?? period;
    const dc = next.displayCurrency !== undefined ? next.displayCurrency : displayCurrency;
    const nextKind = next.orderKind !== undefined ? next.orderKind : orderKindFilter ?? null;
    if (method) params.set("method", method);
    if (status) params.set("status", status);
    if (activePeriod && activePeriod !== "30d") params.set("period", activePeriod);
    if (search) params.set("q", search);
    if (dc && dc !== "GHS") params.set("displayCurrency", dc);
    if (nextKind === "CAR" || nextKind === "PARTS") params.set("orderKind", nextKind);
    appendOpsDateParams(params, sp);
    const reset = next.resetListPages === true;
    const payP = reset ? 1 : next.paymentsPage !== undefined ? next.paymentsPage : listMeta.paymentsPage;
    const walP = reset ? 1 : next.walletPage !== undefined ? next.walletPage : listMeta.walletPage;
    const actP = reset ? 1 : next.actionPage !== undefined ? next.actionPage : listMeta.actionPage;
    if (payP > 1) params.set("paymentsPage", String(payP));
    if (walP > 1) params.set("walletPage", String(walP));
    if (actP > 1) params.set("actionPage", String(actP));
    const query = params.toString();
    return query ? `/admin/payments/intelligence?${query}` : "/admin/payments/intelligence";
  };

  const statusMap = new Map(byStatus.map((r) => [r.status, { count: r._count._all, amount: decimalLikeToNumber(r._sum.amount) }]));
  const methodMap = new Map(
    byMethod.map((r) => [r.settlementMethod, { count: r._count._all, amount: decimalLikeToNumber(r._sum.amount) }]),
  );

  const statusSlices = PAYMENT_STATUS_ORDER.map((s) => {
    const m = statusMap.get(s) ?? { count: 0, amount: 0 };
    return { key: s, label: s.replaceAll("_", " "), count: m.count, amountGhs: m.amount };
  });
  const methodSlices = SETTLEMENT_METHOD_ORDER.map((m) => {
    const x = methodMap.get(m) ?? { count: 0, amount: 0 };
    return { key: m, label: settlementMethodLabel(m), count: x.count, amountGhs: x.amount };
  });

  const ordersHref = (() => {
    const p = new URLSearchParams();
    appendOpsDateParams(p, sp);
    const q = p.toString();
    return q ? `/admin/orders?${q}` : "/admin/orders";
  })();

  const ordersCarHref = (() => {
    const p = new URLSearchParams();
    p.set("kind", "CAR");
    appendOpsDateParams(p, sp);
    return `/admin/orders?${p.toString()}`;
  })();

  const ordersPartsHref = (() => {
    const p = new URLSearchParams();
    p.set("kind", "PARTS");
    appendOpsDateParams(p, sp);
    return `/admin/orders?${p.toString()}`;
  })();

  const shippingHref = (() => {
    const p = new URLSearchParams();
    appendOpsDateParams(p, sp);
    const qs = p.toString();
    return qs ? `/admin/shipping?${qs}` : "/admin/shipping";
  })();

  return (
    <div className="space-y-10 pb-16">
      <Suspense fallback={<div className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[0.02]" />}>
        <AdminOperationsDateFilter />
      </Suspense>

      <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#0b1220] via-[#0d111c] to-[#14101c] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_-32px_rgba(49,182,199,0.35)]">
        <div className="border-b border-white/[0.06] bg-black/20 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--brand)]">Finance operations</p>
              <PageHeading variant="dashboard" className="mt-1 sm:text-3xl">
                Payment intelligence
              </PageHeading>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                Live revenue, settlement health, wallet flows, and inventory-level profit — aligned with the same date window as
                orders and shipping.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/admin/settings"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-white/25 hover:bg-white/[0.08]"
                >
                  <Wrench className="size-3.5 opacity-80" aria-hidden />
                  Providers
                </Link>
                <Link
                  href="/admin/disputes"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-white/25 hover:bg-white/[0.08]"
                >
                  <CreditCard className="size-3.5 opacity-80" aria-hidden />
                  Disputes
                </Link>
                <Suspense fallback={<span className="text-xs text-zinc-500">Export…</span>}>
                  <AdminPaymentsExportButtons />
                </Suspense>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">Display</span>
                {(["GHS", "USD", "CNY"] as const).map((c) => (
                  <Link
                    key={c}
                    href={buildHref({ displayCurrency: c === "GHS" ? null : c, resetListPages: true })}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                      displayCurrency === c
                        ? "border-[var(--brand)]/70 bg-[var(--brand)]/15 text-[var(--brand)]"
                        : "border-white/12 text-zinc-400 hover:border-white/25 hover:text-white"
                    }`}
                  >
                    {c}
                  </Link>
                ))}
                <Link
                  href="/admin/settings/currency"
                  className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-zinc-500 hover:border-[var(--brand)]/40 hover:text-[var(--brand)]"
                >
                  FX rates
                </Link>
              </div>
            </div>
          </div>

          <nav
            className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.05] pt-4"
            aria-label="Cross-module drilldowns"
          >
            <Link
              href={ordersHref}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-[var(--brand)]/35 hover:bg-[var(--brand)]/10"
            >
              <Package className="size-3.5 text-[var(--brand)]" aria-hidden />
              All orders
              <ArrowRight className="size-3 opacity-50" aria-hidden />
            </Link>
            <Link
              href={ordersCarHref}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-white/20"
            >
              Cars only
            </Link>
            <Link
              href={ordersPartsHref}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-white/20"
            >
              Parts only
            </Link>
            <Link
              href={shippingHref}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-cyan-500/30 hover:bg-cyan-500/10"
            >
              <Ship className="size-3.5 text-cyan-400/90" aria-hidden />
              Shipping hub
              <ArrowRight className="size-3 opacity-50" aria-hidden />
            </Link>
            <Link
              href={buildHref({ status: "FAILED", resetListPages: true })}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20"
            >
              Failed payments
            </Link>
          </nav>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Time range</p>
            <div className="flex flex-wrap gap-2">
              {(["7d", "30d", "90d", "all"] as const).map((p) => (
                <Link
                  key={p}
                  href={buildHref({ period: p, resetListPages: true })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    period === p
                      ? "border-[var(--brand)]/60 bg-[var(--brand)]/12 text-[var(--brand)]"
                      : "border-white/12 text-zinc-400 hover:border-white/22 hover:text-white"
                  }`}
                >
                  {p === "all" ? "All time" : `Last ${p.slice(0, -1)} days`}
                </Link>
              ))}
              <Link
                href="/admin/payments/intelligence"
                className="rounded-full border border-white/12 px-3 py-1.5 text-xs text-zinc-500 hover:text-white"
              >
                Reset all
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Order type</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by order kind">
              <Link
                href={buildHref({ orderKind: "", resetListPages: true })}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  !orderKindFilter ? "border-white/25 bg-white/10 text-white" : "border-white/12 text-zinc-400 hover:text-white"
                }`}
              >
                All kinds
              </Link>
              <Link
                href={buildHref({ orderKind: "CAR", resetListPages: true })}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  orderKindFilter === "CAR"
                    ? "border-[var(--brand)]/60 bg-[var(--brand)]/12 text-[var(--brand)]"
                    : "border-white/12 text-zinc-400 hover:text-white"
                }`}
              >
                <Package className="size-3.5" aria-hidden />
                Cars inventory
              </Link>
              <Link
                href={buildHref({ orderKind: "PARTS", resetListPages: true })}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  orderKindFilter === "PARTS"
                    ? "border-[var(--brand)]/60 bg-[var(--brand)]/12 text-[var(--brand)]"
                    : "border-white/12 text-zinc-400 hover:text-white"
                }`}
              >
                <CreditCard className="size-3.5" aria-hidden />
                Parts &amp; accessories
              </Link>
            </div>
          </div>

          {ops.range ? (
            <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95">
              Calendar filter active ({ops.label}, UTC). Quick period chips do not override this window.
            </p>
          ) : null}

          <form
            method="get"
            action="/admin/payments/intelligence"
            className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
          >
            {methodFilter ? <input type="hidden" name="method" value={methodFilter} /> : null}
            {statusFilter ? <input type="hidden" name="status" value={statusFilter} /> : null}
            {orderKindFilter ? <input type="hidden" name="orderKind" value={orderKindFilter} /> : null}
            {period !== "30d" ? <input type="hidden" name="period" value={period} /> : null}
            {typeof sp.opsDateMode === "string" && ["day", "month", "year"].includes(sp.opsDateMode) ? (
              <input type="hidden" name="opsDateMode" value={sp.opsDateMode} />
            ) : null}
            {typeof sp.opsDateDay === "string" ? <input type="hidden" name="opsDateDay" value={sp.opsDateDay} /> : null}
            {typeof sp.opsDateMonth === "string" ? <input type="hidden" name="opsDateMonth" value={sp.opsDateMonth} /> : null}
            {typeof sp.opsDateYear === "string" ? <input type="hidden" name="opsDateYear" value={sp.opsDateYear} /> : null}
            {displayCurrency !== "GHS" ? <input type="hidden" name="displayCurrency" value={displayCurrency} /> : null}
            <label htmlFor="intel-search" className="sr-only">
              Search payments
            </label>
            <input
              id="intel-search"
              name="q"
              defaultValue={q}
              placeholder="Search reference, payment id, order ref, email…"
              className="h-11 min-h-[44px] w-full min-w-0 flex-1 rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white placeholder:text-zinc-500 focus:border-[var(--brand)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/25 sm:min-w-[280px]"
            />
            <button
              type="submit"
              className="h-11 min-h-[44px] shrink-0 rounded-xl bg-[var(--brand)] px-5 text-sm font-semibold text-black transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      <section className="space-y-3" aria-label="Payment summary KPIs">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-white">Liquidity pulse</h2>
          <p className="text-[11px] text-zinc-500">Paystack payment rows in the active filter window</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex gap-4 overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/12 to-black/50 p-4 shadow-lg shadow-emerald-950/20 sm:p-5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">
              <Banknote className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase leading-snug tracking-wide text-emerald-200/90">
                Successful collections
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums leading-none text-emerald-50">
                {formatIntelMoneyFromGhs(successValue, displayCurrency, fx)}
              </p>
              <p className="mt-2 text-xs leading-snug text-emerald-200/75">{successCount} successful payment records</p>
            </div>
          </div>
          <div className="flex gap-4 overflow-hidden rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-500/12 to-black/50 p-4 shadow-lg shadow-rose-950/20 sm:p-5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-500/10 text-rose-300">
              <TrendingUp className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase leading-snug tracking-wide text-rose-200/90">Failed payment value</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums leading-none text-rose-50">
                {formatIntelMoneyFromGhs(failedValue, displayCurrency, fx)}
              </p>
              <p className="mt-2 text-xs leading-snug text-rose-200/75">{failedCount} failed transactions</p>
            </div>
          </div>
          <div className="flex gap-4 overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 to-black/50 p-4 sm:p-5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-500/10 text-sky-300">
              <CreditCard className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase leading-snug tracking-wide text-sky-200/90">Conversion rate</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums leading-none text-sky-50">{conversionRate.toFixed(1)}%</p>
              <p className="mt-2 text-xs leading-snug text-sky-200/75">{totals} payment records in range</p>
            </div>
          </div>
          <div className="flex gap-4 overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-black/50 p-4 sm:p-5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-500/10 text-amber-300">
              <Package className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase leading-snug tracking-wide text-amber-200/90">Attention queue</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums leading-none text-amber-50">{listMeta.actionTotal}</p>
              <p className="mt-2 text-xs leading-snug text-amber-200/75">
                {awaitingProofNoUpload} awaiting proof · {pendingProofReview} proofs pending review
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-label="Sales and profit summary">
        <h2 className="text-sm font-semibold tracking-tight text-white">Commercial summary</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-black/30 p-5 ring-1 ring-white/[0.04]">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-white/5 text-zinc-300">
                <Wallet className="size-4" aria-hidden />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Gross sales tracked</p>
            </div>
            <p className="mt-4 text-2xl font-semibold tabular-nums text-white">{formatIntelMoneyFromGhs(grossSales, displayCurrency, fx)}</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Paystack success + wallet parts ({formatIntelMoneyFromGhs(partsSalesFromWallet, displayCurrency, fx)}).
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-black/30 p-5 ring-1 ring-white/[0.04]">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-white/5 text-zinc-300">
                <ArrowRight className="size-4" aria-hidden />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Wallet net flow</p>
            </div>
            <p className={`mt-4 text-2xl font-semibold tabular-nums ${netWalletFlow >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
              {formatIntelMoneyFromGhs(netWalletFlow, displayCurrency, fx)}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Credits {formatIntelMoneyFromGhs(walletCredits, displayCurrency, fx)} · Debits{" "}
              {formatIntelMoneyFromGhs(walletDebits, displayCurrency, fx)} · Pending {walletPendingCount}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-950/40 via-black/40 to-black/60 p-5 ring-1 ring-emerald-500/10 lg:min-h-[11rem]">
            <div className="flex items-center gap-2 border-b border-emerald-500/10 pb-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                <TrendingUp className="size-4" aria-hidden />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Gross profit (est.)</p>
            </div>
            <p className="mt-4 text-2xl font-semibold tabular-nums text-emerald-200">
              {formatIntelMoneyFromGhs(totalProfitEstGhs, displayCurrency, fx)}
            </p>
            <dl className="mt-3 grid gap-2 text-xs text-zinc-500 sm:grid-cols-2">
              <div className="rounded-lg bg-black/30 px-2.5 py-2">
                <dt className="text-[10px] uppercase tracking-wide text-zinc-600">Revenue</dt>
                <dd className="mt-0.5 font-medium text-zinc-200">{formatIntelMoneyFromGhs(totalRevenueEstGhs, displayCurrency, fx)}</dd>
              </div>
              <div className="rounded-lg bg-black/30 px-2.5 py-2">
                <dt className="text-[10px] uppercase tracking-wide text-zinc-600">COGS</dt>
                <dd className="mt-0.5 font-medium text-zinc-200">{formatIntelMoneyFromGhs(profitIntel.cogsGhs, displayCurrency, fx)}</dd>
              </div>
              <div className="rounded-lg bg-black/30 px-2.5 py-2">
                <dt className="text-[10px] uppercase tracking-wide text-zinc-600">Cars profit</dt>
                <dd className="mt-0.5 font-medium text-zinc-200">{formatIntelMoneyFromGhs(profitSplit.car.profitGhs, displayCurrency, fx)}</dd>
              </div>
              <div className="rounded-lg bg-black/30 px-2.5 py-2">
                <dt className="text-[10px] uppercase tracking-wide text-zinc-600">Parts profit</dt>
                <dd className="mt-0.5 font-medium text-zinc-200">{formatIntelMoneyFromGhs(profitSplit.parts.profitGhs, displayCurrency, fx)}</dd>
              </div>
              <div className="rounded-lg bg-black/30 px-2.5 py-2 sm:col-span-2">
                <dt className="text-[10px] uppercase tracking-wide text-zinc-600">Parts Finder activation</dt>
                <dd className="mt-0.5 font-medium text-zinc-200">
                  {formatIntelMoneyFromGhs(partsFinderActivationProfitGhs, displayCurrency, fx)}
                  <span className="ml-1.5 font-normal text-zinc-500">
                    ({partsFinderActivationCount} payment{partsFinderActivationCount === 1 ? "" : "s"} · no COGS)
                  </span>
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] text-zinc-600">
              {profitIntel.ordersAttributed} Paystack payment(s) tied to orders
              {partsFinderActivationCount > 0 ? (
                <>
                  {" "}
                  · {partsFinderActivationCount} Parts Finder activation
                  {partsFinderActivationCount === 1 ? "" : "s"}
                </>
              ) : null}{" "}
              in this view.
            </p>
            {profitIntel.ordersWithMissingCost > 0 ? (
              <p className="mt-2 text-xs text-amber-200/90">
                {profitIntel.ordersWithMissingCost} attribution(s) missing supplier cost — margin may be overstated until costs are set.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <AdminPaymentIntelligenceCharts
        paymentRecordCount={totals}
        orderKindFilter={orderKindFilter ?? null}
        statusSlices={statusSlices}
        methodSlices={methodSlices}
        profitSplit={{
          carProfitGhs: profitSplit.car.profitGhs,
          partsProfitGhs: profitSplit.parts.profitGhs,
          carRevenueGhs: profitSplit.car.revenueGhs,
          partsRevenueGhs: profitSplit.parts.revenueGhs,
          partsFinderProfitGhs: partsFinderActivationProfitGhs,
          partsFinderRevenueGhs: partsFinderActivationRevenueGhs,
        }}
      />

      <section className="grid gap-6 lg:grid-cols-2" aria-label="Filterable status and channel breakdown">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Status filters</h2>
          <p className="mt-1 text-xs text-zinc-600">Tap to apply to the table below.</p>
          <ul className="mt-4 max-h-[min(22rem,50vh)] space-y-2 overflow-y-auto overscroll-contain pr-1">
            {PAYMENT_STATUS_ORDER.map((s) => {
              const m = statusMap.get(s) ?? { count: 0, amount: 0 };
              return (
                <li key={s}>
                  <Link
                    href={buildHref({ status: s, resetListPages: true })}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                      statusFilter === s
                        ? "border-[var(--brand)]/50 bg-[var(--brand)]/10 text-white"
                        : "border-white/8 bg-black/25 text-zinc-200 hover:border-white/15"
                    }`}
                  >
                    <span>{s.replaceAll("_", " ")}</span>
                    <span className="flex items-center gap-2 font-mono text-xs text-zinc-500">
                      <span>{m.count}</span>
                      <span className="text-[var(--brand)]">{formatIntelMoneyFromGhs(m.amount, displayCurrency, fx)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Settlement filters</h2>
          <p className="mt-1 text-xs text-zinc-600">Tap to filter by payment route.</p>
          <ul className="mt-4 max-h-[min(22rem,50vh)] space-y-2 overflow-y-auto overscroll-contain pr-1">
            {SETTLEMENT_METHOD_ORDER.map((m) => {
              const x = methodMap.get(m) ?? { count: 0, amount: 0 };
              return (
                <li key={m}>
                  <Link
                    href={buildHref({ method: m, resetListPages: true })}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                      methodFilter === m
                        ? "border-[var(--brand)]/50 bg-[var(--brand)]/10 text-white"
                        : "border-white/8 bg-black/25 text-zinc-200 hover:border-white/15"
                    }`}
                  >
                    <span>{settlementMethodLabel(m)}</span>
                    <span className="flex items-center gap-2 font-mono text-xs text-zinc-500">
                      <span>{x.count}</span>
                      <span className="text-[var(--brand)]">{formatIntelMoneyFromGhs(x.amount, displayCurrency, fx)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section aria-labelledby="intel-payments-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h2 id="intel-payments-heading" className="text-lg font-semibold text-white">
            Payment records
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildHref({ status: null, method: null, resetListPages: true })}
              className="rounded-lg border border-white/12 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-white/20 hover:text-white"
            >
              Clear status / method
            </Link>
            <Link
              href={buildHref({ status: "FAILED", resetListPages: true })}
              className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/20"
            >
              Failed only
            </Link>
          </div>
        </div>
        <div className="mt-4 -mx-1 sda-table-scroll rounded-2xl border border-white/10 sm:mx-0">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <caption className="border-b border-white/10 bg-white/[0.02] px-4 py-2 text-left text-xs text-zinc-500">
              Payments matching current filters · {listMeta.pageSize} per page · scroll horizontally on small screens
            </caption>
            <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                <th scope="col" className="px-4 py-3">
                  Channel
                </th>
                <th scope="col" className="px-4 py-3">
                  Type
                </th>
                <th scope="col" className="px-4 py-3">
                  Amount
                </th>
                <th scope="col" className="px-4 py-3">
                  Provider ref
                </th>
                <th scope="col" className="px-4 py-3">
                  Customer
                </th>
                <th scope="col" className="px-4 py-3">
                  Order
                </th>
                <th scope="col" className="px-4 py-3">
                  Last updated
                </th>
                <th scope="col" className="px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {listMeta.paymentsTotal === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-zinc-500">
                    No payments found for current filters.
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <PaymentStatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{settlementMethodLabel(p.settlementMethod)}</td>
                    <td className="px-4 py-3 text-zinc-400">{p.paymentType.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 text-[var(--brand)]">
                      {formatIntelPaymentAmount(Number(p.amount), p.currency, displayCurrency, fx)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{p.providerReference ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-300">{p.user?.email ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{p.order?.reference ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(p.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Link className="text-[var(--brand)] hover:underline" href={`/admin/payments/${p.id}`}>
                          Manage
                        </Link>
                        {p.orderId ? (
                          <Link className="text-zinc-400 hover:text-white" href={`/admin/orders/${p.orderId}`}>
                            Order
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <ListPaginationFooter
          className="px-1 sm:px-0"
          pageSize={listMeta.pageSize}
          page={listMeta.paymentsPage}
          totalPages={listMeta.paymentsTotalPages}
          totalItems={listMeta.paymentsTotal}
          itemLabel="Payment records"
          prevHref={listMeta.paymentsPage > 1 ? buildHref({ paymentsPage: listMeta.paymentsPage - 1 }) : null}
          nextHref={
            listMeta.paymentsPage < listMeta.paymentsTotalPages
              ? buildHref({ paymentsPage: listMeta.paymentsPage + 1 })
              : null
          }
        />
      </section>

      <section aria-labelledby="intel-wallet-heading">
        <h2 id="intel-wallet-heading" className="text-lg font-semibold text-white">
          Wallet transactions
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Unified wallet inflow/outflow ledger to audit top-ups, parts purchase debits, and pending wallet outcomes.
        </p>
        <div className="mt-4 -mx-1 sda-table-scroll rounded-2xl border border-white/10 sm:mx-0">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <caption className="border-b border-white/10 bg-white/[0.02] px-4 py-2 text-left text-xs text-zinc-500">
              Wallet ledger rows in the same date window as payments · {listMeta.pageSize} per page
            </caption>
            <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Created
                </th>
                <th scope="col" className="px-4 py-3">
                  Reference
                </th>
                <th scope="col" className="px-4 py-3">
                  Direction
                </th>
                <th scope="col" className="px-4 py-3">
                  Purpose
                </th>
                <th scope="col" className="px-4 py-3">
                  Route
                </th>
                <th scope="col" className="px-4 py-3">
                  Amount
                </th>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                <th scope="col" className="px-4 py-3">
                  Customer
                </th>
                <th scope="col" className="px-4 py-3">
                  Order
                </th>
              </tr>
            </thead>
            <tbody>
              {listMeta.walletTotal === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-zinc-500">
                    No wallet transactions in range.
                  </td>
                </tr>
              ) : (
                walletRows.map((t) => (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(t.createdAt)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">{t.reference}</td>
                    <td className="px-4 py-3 text-zinc-200">{t.direction}</td>
                    <td className="px-4 py-3 text-zinc-300">{t.purpose.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 text-zinc-400">{settlementMethodLabel(t.method)}</td>
                    <td className="px-4 py-3 text-[var(--brand)]">
                      {formatIntelPaymentAmount(Number(t.amount), t.currency, displayCurrency, fx)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] ${
                          t.status === "SUCCESS"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : t.status === "PENDING"
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-rose-500/15 text-rose-300"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{t.user?.email ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{t.order?.reference ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <ListPaginationFooter
          className="px-1 sm:px-0"
          pageSize={listMeta.pageSize}
          page={listMeta.walletPage}
          totalPages={listMeta.walletTotalPages}
          totalItems={listMeta.walletTotal}
          itemLabel="Wallet transactions"
          prevHref={listMeta.walletPage > 1 ? buildHref({ walletPage: listMeta.walletPage - 1 }) : null}
          nextHref={
            listMeta.walletPage < listMeta.walletTotalPages ? buildHref({ walletPage: listMeta.walletPage + 1 }) : null
          }
        />
      </section>

      <section aria-labelledby="intel-action-heading">
        <h2 id="intel-action-heading" className="text-lg font-semibold text-white">
          Action queue
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Failed, awaiting proof, and pending-proof uploads that need immediate operations follow-up.
        </p>
        <div className="mt-4 -mx-1 sda-table-scroll rounded-2xl border border-white/10 sm:mx-0">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <caption className="border-b border-white/10 bg-amber-500/5 px-4 py-2 text-left text-xs text-amber-200/80">
              Items requiring staff review · {listMeta.pageSize} per page
            </caption>
            <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                <th scope="col" className="px-4 py-3">
                  Route
                </th>
                <th scope="col" className="px-4 py-3">
                  Amount
                </th>
                <th scope="col" className="px-4 py-3">
                  Proofs
                </th>
                <th scope="col" className="px-4 py-3">
                  Latest proof
                </th>
                <th scope="col" className="px-4 py-3">
                  Customer
                </th>
                <th scope="col" className="px-4 py-3">
                  Reference
                </th>
                <th scope="col" className="px-4 py-3">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {listMeta.actionTotal === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-zinc-500">
                    Nothing in action queue.
                  </td>
                </tr>
              ) : (
                attention.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <PaymentStatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{settlementMethodLabel(p.settlementMethod)}</td>
                    <td className="px-4 py-3 text-[var(--brand)]">
                      {formatIntelPaymentAmount(Number(p.amount), p.currency, displayCurrency, fx)}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {p.proofs.length} ({p.proofs.filter((x) => x.status === "PENDING").length} pending)
                    </td>
                    <td className="px-4 py-3 align-top">
                      <IntelActionProofPeek proofs={p.proofs} />
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{p.user?.email ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{p.providerReference ?? p.order?.reference ?? p.id}</td>
                    <td className="px-4 py-3">
                      <Link className="text-[var(--brand)] hover:underline" href={`/admin/payments/${p.id}`}>
                        Open manager
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <ListPaginationFooter
          className="px-1 sm:px-0"
          pageSize={listMeta.pageSize}
          page={listMeta.actionPage}
          totalPages={listMeta.actionTotalPages}
          totalItems={listMeta.actionTotal}
          itemLabel="Action queue"
          prevHref={listMeta.actionPage > 1 ? buildHref({ actionPage: listMeta.actionPage - 1 }) : null}
          nextHref={
            listMeta.actionPage < listMeta.actionTotalPages ? buildHref({ actionPage: listMeta.actionPage + 1 }) : null
          }
        />
        <p className="mt-4 text-xs text-zinc-500">
          Refunded value: {formatIntelMoneyFromGhs(refundedValue, displayCurrency, fx)} · Pending: {pendingCount} · Disputed:{" "}
          {disputedCount} ·
          Awaiting proof: {awaitingProofCount}
        </p>
      </section>
    </div>
  );
}
