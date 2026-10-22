"use client";

import type { OrderKind } from "@prisma/client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type IntelStatusSlice = { key: string; label: string; count: number; amountGhs: number };
export type IntelMethodSlice = { key: string; label: string; count: number; amountGhs: number };
export type IntelProfitSplit = {
  carProfitGhs: number;
  partsProfitGhs: number;
  carRevenueGhs: number;
  partsRevenueGhs: number;
  partsFinderProfitGhs: number;
  partsFinderRevenueGhs: number;
};

const STATUS_COLORS = ["#34d399", "#fbbf24", "#60a5fa", "#a78bfa", "#f87171", "#94a3b8", "#fb7185"];
const METHOD_COLORS = ["#31b6c7", "#22d3ee", "#818cf8", "#c084fc", "#fb923c", "#f472b6", "#a3e635"];
const CHART_TICK = { fill: "#e4e4e7", fontSize: 10 } as const;
const CHART_AXIS = { stroke: "#a1a1aa" };
const CHART_GRID = "rgba(255,255,255,0.18)";
const CHART_TOOLTIP = {
  background: "#0a0d12",
  border: "1px solid rgba(255,255,255,0.22)",
  borderRadius: 12,
  fontSize: 12,
  color: "#f4f4f5",
} as const;

function formatCompactGhs(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

function StatusVolumeStrip({ slices }: { slices: IntelStatusSlice[] }) {
  const maxCount = Math.max(1, ...slices.map((s) => s.count));
  return (
    <ul className="mt-4 space-y-2.5" aria-label="Payment status volume">
      {slices.map((s) => (
        <li key={s.key} className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 truncate text-zinc-200">{s.label}</span>
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--brand)] to-cyan-300 transition-all"
              style={{ width: `${Math.max(4, (s.count / maxCount) * 100)}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right font-mono text-zinc-100">{s.count}</span>
        </li>
      ))}
    </ul>
  );
}

export function AdminPaymentIntelligenceCharts({
  paymentRecordCount,
  orderKindFilter,
  statusSlices,
  methodSlices,
  profitSplit,
}: {
  paymentRecordCount: number;
  orderKindFilter: OrderKind | null;
  statusSlices: IntelStatusSlice[];
  methodSlices: IntelMethodSlice[];
  profitSplit: IntelProfitSplit;
}) {
  const pieData = statusSlices.filter((s) => s.count > 0);
  const maxMethod = Math.max(1, ...methodSlices.map((m) => m.amountGhs));
  const methodChartData = methodSlices.map((m) => ({
    ...m,
    pct: maxMethod > 0 ? Math.round((m.amountGhs / maxMethod) * 100) : 0,
  }));
  const profitBar = [
    { name: "Cars inventory", profit: Math.max(0, profitSplit.carProfitGhs), revenue: profitSplit.carRevenueGhs },
    { name: "Parts & accessories", profit: Math.max(0, profitSplit.partsProfitGhs), revenue: profitSplit.partsRevenueGhs },
    {
      name: "Parts Finder activation",
      profit: Math.max(0, profitSplit.partsFinderProfitGhs),
      revenue: profitSplit.partsFinderRevenueGhs,
    },
  ];
  const hasProfitSignal = profitBar.some((b) => b.profit > 0 || b.revenue > 0);
  const kindHint =
    orderKindFilter === "PARTS"
      ? "Parts filter limits Paystack rows to parts orders only. If customers paid from wallet only, counts can be zero while wallet data still shows above."
      : orderKindFilter === "CAR"
        ? "Cars filter limits Paystack rows to vehicle orders in this window."
        : null;

  return (
    <section className="space-y-4" aria-labelledby="intel-analytics-heading">
      <div className="flex flex-col gap-1 border-b border-border pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="intel-analytics-heading" className="text-sm font-semibold tracking-tight text-foreground">
            Analytics monitor
          </h2>
          <p className="sda-readable-muted mt-1 max-w-2xl text-xs leading-relaxed">
            Charts use the same filters as the tables. Settlement bars scale to the largest channel in view; profit split reflects
            successful Paystack payments linked to orders plus Parts Finder membership activations (no COGS).
          </p>
        </div>
        <p className="sda-readable-muted text-[11px] font-mono">{paymentRecordCount} payment row(s) in filter</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3" role="region" aria-label="Payment analytics charts">
        <div className="sda-ink-panel flex flex-col rounded-2xl p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-100">Payment status mix</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-200">Donut = share of Paystack rows by status (count).</p>
          <div className="mt-3 min-h-[220px] flex-1 w-full min-w-0">
            {pieData.length === 0 ? (
              <div className="flex h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/20 bg-black/40 px-4 text-center">
                <div className="flex size-16 items-center justify-center rounded-full border border-white/20 bg-white/10">
                  <span className="text-2xl text-zinc-300" aria-hidden>
                    ◎
                  </span>
                </div>
                <p className="text-sm font-medium text-zinc-100">No Paystack status mix in this slice</p>
                <p className="max-w-xs text-xs leading-relaxed text-zinc-200">
                  {paymentRecordCount === 0
                    ? "There are no payment records for the current filters. Try “All kinds”, widen the date range, or review wallet activity in the commercial summary."
                    : "All matching payments have zero count per status (unusual). Clear filters or verify data."}
                  {kindHint ? ` ${kindHint}` : ""}
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Pie
                    data={pieData}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={76}
                    paddingAngle={2}
                    label={false}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={pieData[i].key} fill={STATUS_COLORS[i % STATUS_COLORS.length]} stroke="rgba(0,0,0,0.4)" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={CHART_TOOLTIP}
                    formatter={(value: number, _n, item) => [
                      `${value} records · GHS ${formatCompactGhs((item.payload as IntelStatusSlice).amountGhs)}`,
                      "Slice",
                    ]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={28}
                    formatter={(value) => <span className="text-[11px] text-zinc-200">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 border-t border-white/15 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--brand-readable)]">Relative volume</p>
            <StatusVolumeStrip slices={statusSlices} />
          </div>
        </div>

        <div className="sda-ink-panel flex flex-col rounded-2xl p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-100">Settlement volume</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-200">Horizontal bars: GHS amount by settlement route (all statuses in filter).</p>
          <div className="mt-3 min-h-[220px] w-full min-w-0 flex-1">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={methodChartData} layout="vertical" margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
                <XAxis
                  type="number"
                  tick={CHART_TICK}
                  axisLine={CHART_AXIS}
                  tickFormatter={formatCompactGhs}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={108}
                  tick={CHART_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP}
                  formatter={(v: number, _k, item) => [
                    `GHS ${formatCompactGhs(v)} · ${(item.payload as IntelMethodSlice).count} tx · ${(item.payload as { pct: number }).pct}% of max channel`,
                    "Amount",
                  ]}
                />
                <Bar dataKey="amountGhs" name="GHS" radius={[0, 6, 6, 0]}>
                  {methodChartData.map((_, i) => (
                    <Cell key={methodChartData[i].key} fill={METHOD_COLORS[i % METHOD_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="sda-ink-panel flex flex-col rounded-2xl p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-100">Inventory profit split</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-200">Estimated gross profit (GHS) from successful Paystack-tied orders by catalog kind.</p>
          <div className="mt-3 min-h-[220px] w-full min-w-0 flex-1">
            {!hasProfitSignal ? (
              <div className="flex h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-black/40 px-4 text-center">
                <p className="text-sm font-medium text-zinc-100">No attributed profit in this window</p>
                <p className="max-w-xs text-xs text-zinc-200">
                  Profit requires successful Paystack rows in this window. Vehicle/parts orders (with costs) or Parts Finder
                  activations. Widen filters or switch to “All kinds”.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={profitBar} margin={{ top: 12, right: 12, left: 4, bottom: 36 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={CHART_TICK}
                    axisLine={CHART_AXIS}
                    interval={0}
                    angle={-8}
                    textAnchor="end"
                    height={44}
                  />
                  <YAxis tick={CHART_TICK} axisLine={false} tickLine={false} tickFormatter={formatCompactGhs} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP}
                    formatter={(profit: number, _k, item) => {
                      const r = (item.payload as { revenue: number }).revenue;
                      return [`Profit GHS ${formatCompactGhs(profit)} · Rev ${formatCompactGhs(r)}`, "Estimate"];
                    }}
                  />
                  <Bar dataKey="profit" name="Profit (GHS)" fill="#4ade80" radius={[8, 8, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
