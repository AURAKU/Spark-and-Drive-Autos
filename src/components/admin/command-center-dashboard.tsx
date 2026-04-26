"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ListPaginationFooter } from "@/components/ui/list-pagination";

export type CommandCenterActivity = {
  id: string;
  label: string;
  sub: string;
  at: string;
  href: string | null;
};

export type CommandCenterProps = {
  summaryCards: { label: string; value: string | number }[];
  inventoryBars: { name: string; cars: number; parts: number }[];
  partsHealth: { name: string; value: number; fill: string }[];
  revenueGhs: number;
  activity: CommandCenterActivity[];
  activityPage: number;
  activityTotalPages: number;
  activityTotal: number;
  activityPageSize: number;
  activityPrevHref: string | null;
  activityNextHref: string | null;
  activityPageHrefs?: string[];
};

const PIE_COLORS = ["#22c55e", "#eab308", "#ef4444", "#a855f7"];

export function CommandCenterDashboard({
  summaryCards,
  inventoryBars,
  partsHealth,
  revenueGhs,
  activity,
  activityPage,
  activityTotalPages,
  activityTotal,
  activityPageSize,
  activityPrevHref,
  activityNextHref,
  activityPageHrefs,
}: CommandCenterProps) {
  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-5 shadow-lg shadow-black/20"
          >
            <p className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">{c.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold text-white">Inventory mix</h2>
          <p className="mt-1 text-xs text-zinc-500">Cars vs parts across key operational buckets</p>
          <div className="mt-4 h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventoryBars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={{ stroke: "#3f3f46" }} />
                <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "#18181b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    color: "#fafafa",
                  }}
                />
                <Bar dataKey="cars" name="Cars" fill="var(--brand, #bef264)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="parts" name="Parts" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold text-white">Parts health</h2>
          <p className="mt-1 text-xs text-zinc-500">Stock posture (live counts)</p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="h-56 w-full min-w-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={partsHealth}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {partsHealth.map((entry, i) => (
                      <Cell key={entry.name} fill={entry.fill ?? PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#18181b",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      color: "#fafafa",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-2 text-sm text-zinc-400">
              {partsHealth.map((p, i) => (
                <li key={p.name} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: p.fill ?? PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    {p.name}
                  </span>
                  <span className="tabular-nums text-white">{p.value}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-4 text-xs text-zinc-600">
            Successful payments (all time):{" "}
            <span className="text-[var(--brand)]">GHS {revenueGhs.toLocaleString()}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:col-span-1">
          <h2 className="text-sm font-semibold text-white">Quick actions</h2>
          <p className="mt-1 text-xs text-zinc-500">Shortcuts to high-frequency workflows</p>
          <div className="mt-4 grid gap-2">
            <Link
              href="/admin/cars?add=1"
              className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white transition hover:border-[var(--brand)]/40 hover:bg-white/[0.05]"
            >
              Add vehicle
            </Link>
            <Link
              href="/admin/parts?tab=catalog&add=1"
              className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white transition hover:border-[var(--brand)]/40 hover:bg-white/[0.05]"
            >
              Add part
            </Link>
            <Link
              href="/admin/parts?tab=categories"
              className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white transition hover:border-[var(--brand)]/40 hover:bg-white/[0.05]"
            >
              Manage categories
            </Link>
            <Link
              href="/admin/parts?tab=delivery"
              className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white transition hover:border-[var(--brand)]/40 hover:bg-white/[0.05]"
            >
              Manage delivery options
            </Link>
            <Link
              href="/admin/cars"
              className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white transition hover:border-[var(--brand)]/40 hover:bg-white/[0.05]"
            >
              Review vehicle inventory
            </Link>
            <Link
              href="/admin/payments"
              className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white transition hover:border-[var(--brand)]/40 hover:bg-white/[0.05]"
            >
              Review payments
            </Link>
            <Link
              href="/admin/security"
              className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-50 transition hover:border-amber-500/40 hover:bg-amber-500/10"
            >
              Security surveillance (threats &amp; signals)
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/5 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Recent activity</h2>
              <p className="mt-1 text-xs text-zinc-500">Latest catalog and audit events · {activityPageSize} per page</p>
            </div>
            <Link
              href="/admin/audit"
              className="shrink-0 text-xs font-medium text-[var(--brand)] hover:underline"
            >
              Full audit log
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-white/5">
            {activity.length === 0 ? (
              <li className="py-6 text-center text-sm text-zinc-500">No recent events yet.</li>
            ) : (
              activity.map((a) => (
                <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-white">{a.label}</p>
                    <p className="truncate text-xs text-zinc-500" title={a.sub}>
                      {a.sub}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs tabular-nums text-zinc-600">{a.at}</span>
                    {a.href ? (
                      <Link href={a.href} className="text-xs font-medium text-[var(--brand)] hover:underline">
                        Open
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))
            )}
          </ul>
          {activityTotal > 0 ? (
            <ListPaginationFooter
              className="border-border/60 dark:border-white/5"
              page={activityPage}
              totalPages={activityTotalPages}
              totalItems={activityTotal}
              pageSize={activityPageSize}
              itemLabel="Events"
              prevHref={activityPrevHref}
              nextHref={activityNextHref}
              pageHrefs={activityPageHrefs}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
