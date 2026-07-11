"use client";

import { formatMoney } from "@/lib/format";

type Props = {
  data: Awaited<ReturnType<typeof import("@/actions/duty-admin-os").getDutyAdminDashboardData>>;
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 dark:border-white/10">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function DutyDashboardClient({ data }: Props) {
  const { dashboard: d } = data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total calculations" value={String(d.totalCalculations)} sub={`${d.calculationsToday} today`} />
        <Stat label="Verified assessments" value={String(d.verifiedAssessments)} sub={`${d.assessmentsAwaitingReview} awaiting review`} />
        <Stat
          label="Avg prediction error"
          value={d.avgPredictionError != null ? `${d.avgPredictionError}%` : "—"}
          sub={d.medianPredictionError != null ? `Median ${d.medianPredictionError}%` : undefined}
        />
        <Stat
          label="Within ±5% / ±10%"
          value={d.within5Pct != null ? `${d.within5Pct}% / ${d.within10Pct}%` : "Insufficient data"}
          sub={d.evaluationNote}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border p-4 dark:border-white/10">
          <h3 className="text-sm font-semibold">Top estimated makes/models</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {d.topMakesModels.length === 0 ? (
              <li className="text-muted-foreground">No calculations yet</li>
            ) : (
              d.topMakesModels.map((row) => (
                <li key={row.label} className="flex justify-between gap-2">
                  <span>{row.label}</span>
                  <span className="font-mono text-muted-foreground">{row.count}</span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-border p-4 dark:border-white/10">
          <h3 className="text-sm font-semibold">Top HS codes</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {d.topHsCodes.length === 0 ? (
              <li className="text-muted-foreground">No HS data yet</li>
            ) : (
              d.topHsCodes.map((row) => (
                <li key={row.hsCode} className="flex justify-between gap-2">
                  <span className="font-mono">{row.hsCode}</span>
                  <span className="text-muted-foreground">{row.count}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border p-4 dark:border-white/10">
          <h3 className="text-sm font-semibold">Fuel / powertrain breakdown</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {d.fuelBreakdown.map((row) => (
              <li key={row.fuelType} className="flex justify-between gap-2">
                <span>{row.fuelType}</span>
                <span className="text-muted-foreground">{row.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-border p-4 dark:border-white/10">
          <h3 className="text-sm font-semibold">FX rates & freshness</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {d.fxRates.map((row) => (
              <li key={`${row.currency}-${row.effectiveDate}`} className="flex justify-between gap-2">
                <span>
                  1 {row.currency} = {row.rate} GHS
                  {row.stale && <span className="ml-2 text-amber-600">stale</span>}
                </span>
                <span className="text-xs text-muted-foreground">{row.source}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-border p-4 dark:border-white/10">
        <h3 className="text-sm font-semibold">Recent rule changes</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {d.recentRuleChanges.length === 0 ? (
            <li className="text-muted-foreground">No calculation rules yet</li>
          ) : (
            d.recentRuleChanges.map((row) => (
              <li key={row.id} className="flex justify-between gap-2">
                <span>
                  {row.chargeKey} <span className="text-muted-foreground">({row.status})</span>
                </span>
                <span className="text-xs text-muted-foreground">{new Date(row.updatedAt).toLocaleString()}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      {d.expiringRuleSets.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium text-amber-800 dark:text-amber-200">Rule sets expiring within 30 days</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {d.expiringRuleSets.map((r, i) => (
              <li key={i}>
                {r.profileId ?? "Global"} — {r.chargeKey} → {r.effectiveTo ? new Date(r.effectiveTo).toLocaleDateString() : "open"}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Evaluation sample: {d.evaluationSampleCount} verified fixture(s). {d.evaluationNote}
      </p>
    </div>
  );
}
