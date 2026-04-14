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
};

const STATUS_COLORS = ["#34d399", "#fbbf24", "#60a5fa", "#a78bfa", "#f87171", "#94a3b8", "#fb7185"];
const METHOD_COLORS = ["#31b6c7", "#22d3ee", "#818cf8", "#c084fc", "#fb923c", "#f472b6", "#a3e635"];

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
          <span className="w-28 shrink-0 truncate text-zinc-500">{s.label}</span>
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--brand)]/70 to-cyan-400/60 transition-all"
              style={{ width: `${Math.max(4, (s.count / maxCount) * 100)}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right font-mono text-zinc-400">{s.count}</span>
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
  ];
  const hasProfitSignal = profitBar.some((b) => b.profit > 0 || b.revenue > 0);
  const kindHint =
    orderKindFilter === "PARTS"
      ? "Parts filter limits Paystack rows to parts orders only — if customers paid from wallet only, counts can be zero while wallet data still shows above."
      : orderKindFilter === "CAR"
        ? "Cars filter limits Paystack rows to vehicle orders in this window."
        : null;

  return (
    <section className="space-y-4" aria-labelledby="intel-analytics-heading">
      <div className="flex flex-col gap-1 border-b border-white/10 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="intel-analytics-heading" className="text-sm font-semibold tracking-tight text-white">
            Analytics monitor
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-500">
            Charts use the same filters as the tables. Settlement bars scale to the largest channel in view; profit split reflects
            successful Paystack payments linked to orders.
          </p>
        </div>
        <p className="text-[11px] font-mono text-zinc-600">{paymentRecordCount} payment row(s) in filter</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3" role="region" aria-label="Payment analytics charts">
        <div className="flex flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] via-black/30 to-black/50 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Payment status mix</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">Donut = share of Paystack rows by status (count).</p>
          <div className="mt-3 min-h-[220px] flex-1 w-full min-w-0">
            {pieData.length === 0 ? (
              <div className="flex h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 bg-black/25 px-4 text-center">
                <div className="flex size-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
                  <span className="text-2xl text-zinc-600" aria-hidden>
                    ◎
                  </span>
                </div>
                <p className="text-sm font-medium text-zinc-400">No Paystack status mix in this slice</p>
                <p className="max-w-xs text-xs leading-relaxed text-zinc-600">
                  {paymentRecordCount === 0
                    ? "There are no payment records for the current filters. Try “All kinds”, widen the date range, or review wallet activity in the commercial summary."
                    : "All matching payments have zero count per status (unusual) — clear filters or verify data."}
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
                    contentStyle={{
                      background: "#0a0d12",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(value: number, _n, item) => [
                      `${value} records · GHS ${formatCompactGhs((item.payload as IntelStatusSlice).amountGhs)}`,
                      "Slice",
                    ]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={28}
                    formatter={(value) => <span className="text-[11px] text-zinc-400">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 border-t border-white/5 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Relative volume</p>
            <StatusVolumeStrip slices={statusSlices} />
          </div>
        </div>

        <div className="flex flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] via-black/30 to-black/50 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Settlement volume</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">Horizontal bars: GHS amount by settlement route (all statuses in filter).</p>
          <div className="mt-3 min-h-[220px] w-full min-w-0 flex-1">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={methodChartData} layout="vertical" margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  axisLine={{ stroke: "#3f3f46" }}
                  tickFormatter={formatCompactGhs}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={108}
                  tick={{ fill: "#a1a1aa", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0a0d12",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
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

        <div className="flex flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] via-black/30 to-black/50 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Inventory profit split</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">Estimated gross profit (GHS) from successful Paystack-tied orders by catalog kind.</p>
          <div className="mt-3 min-h-[220px] w-full min-w-0 flex-1">
            {!hasProfitSignal ? (
              <div className="flex h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-black/25 px-4 text-center">
                <p className="text-sm font-medium text-zinc-400">No attributed profit in this window</p>
                <p className="max-w-xs text-xs text-zinc-600">
                  Profit requires successful payments with linked orders and supplier costs. Widen filters or switch to “All kinds”.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={profitBar} margin={{ top: 12, right: 12, left: 4, bottom: 36 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#a1a1aa", fontSize: 10 }}
                    axisLine={{ stroke: "#3f3f46" }}
                    interval={0}
                    angle={-8}
                    textAnchor="end"
                    height={44}
                  />
                  <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatCompactGhs} />
                  <Tooltip
                    contentStyle={{
                      background: "#0a0d12",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
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
