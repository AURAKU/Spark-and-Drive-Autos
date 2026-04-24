import Link from "next/link";
import { redirect } from "next/navigation";

import { PartsFinderStatCard } from "@/components/parts-finder/parts-finder-stat-card";
import { PageHeading } from "@/components/typography/page-headings";
import {
  getPartsFinderAnalytics,
  PARTS_FINDER_ANALYTICS_TREND_DAYS,
} from "@/lib/parts-finder/intelligence-analytics";
import { safeAuth } from "@/lib/safe-auth";

import { isAdminRole } from "@/auth";

export const dynamic = "force-dynamic";

function RankedList({
  title,
  rows,
  emptyHint,
}: {
  title: string;
  rows: readonly (readonly [string, number])[];
  emptyHint: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm dark:bg-white/[0.03]">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{emptyHint}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {rows.map(([label, count]) => (
            <li key={label} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate" title={label}>
                {label}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function AdminPartsFinderAnalyticsPage() {
  const session = await safeAuth();
  if (!session?.user?.role || !isAdminRole(session.user.role)) redirect("/dashboard");
  const a = await getPartsFinderAnalytics();

  return (
    <div>
      <PageHeading variant="dashboard">Parts Finder · Operations analytics</PageHeading>
      <p className="mt-2 text-sm text-muted-foreground">
        All figures are computed from persisted sessions, conversions, memberships, and payments — no sampled placeholders.
      </p>
      <p className="mt-3 text-xs">
        <Link href="/admin/parts-finder" className="text-[var(--brand)] hover:underline">
          ← Admin hub
        </Link>
        {" · "}
        <Link href="/admin/parts-finder/searches" className="text-[var(--brand)] hover:underline">
          Triage searches
        </Link>
        {" · "}
        <Link href="/admin/parts-finder/memberships" className="text-[var(--brand)] hover:underline">
          Memberships
        </Link>
      </p>

      <section className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Membership & revenue</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PartsFinderStatCard
            label="Active memberships"
            value={a.membership.active}
            hint="Status ACTIVE and end date in the future."
          />
          <PartsFinderStatCard
            label="Expired / lapsed"
            value={a.membership.expired}
            hint="Marked expired or past end date."
          />
          <PartsFinderStatCard
            label="Suspended"
            value={a.membership.suspended}
            hint="Admin suspended — search blocked."
          />
          <PartsFinderStatCard
            label="Membership revenue (GHS)"
            value={a.membershipRevenueGhs.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            hint="Sum of successful PARTS_FINDER_MEMBERSHIP payments."
          />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PartsFinderStatCard
            label="Pending payment"
            value={a.membership.pendingPayments}
            hint="Users with PARTS_FINDER_MEMBERSHIP payment still pending/provider-processing."
          />
          <PartsFinderStatCard
            label="Pending approvals"
            value={a.membership.pendingApprovals}
            hint="Payment succeeded but admin approval required before ACTIVE access."
          />
          <PartsFinderStatCard
            label="Pending search review"
            value={a.membership.pendingSearchReviews}
            hint="Search sessions in PENDING_REVIEW queue."
          />
          <PartsFinderStatCard
            label="Users with renewals (payments)"
            value={a.renewalConversions}
            hint="Distinct users with more than one successful membership payment."
          />
          <PartsFinderStatCard
            label="Activation reach"
            value={a.activationConversionRateFromUpsell}
            suffix="%"
            hint="Share of all users with at least one membership row."
          />
          <PartsFinderStatCard
            label="Avg review turnaround"
            value={a.reviewTurnaroundMinutes}
            hint="Mean minutes from session created to reviewedAt (all time)."
          />
        </div>
      </section>

      <section className="mt-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Search volume & quality</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PartsFinderStatCard label="Total searches" value={a.totalSearches} />
          <PartsFinderStatCard
            label="With ranked results"
            value={a.successfulResults}
            hint="Sessions where ranked results were persisted."
          />
          <PartsFinderStatCard label="Avg confidence (top score)" value={a.averageConfidenceScore} suffix="%" />
          <PartsFinderStatCard
            label="Sessions with any conversion"
            value={a.sessionConversionRate}
            suffix="%"
            hint="Share of searches that logged at least one conversion row."
          />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PartsFinderStatCard
            label="Verified outcomes"
            value={a.reviewOps.verified}
            hint="Sessions explicitly marked VERIFIED by admin workflow."
          />
          <PartsFinderStatCard
            label="Rejected outcomes"
            value={a.reviewOps.rejected}
            hint="Sessions explicitly rejected after review."
          />
          <PartsFinderStatCard
            label="Low-confidence queue"
            value={a.reviewOps.lowConfidence}
            hint="Sessions marked LOW_CONFIDENCE and requiring careful support handling."
          />
          <PartsFinderStatCard
            label="Flagged sourcing queue"
            value={a.reviewOps.flaggedSourcing}
            hint="Sessions flagged for sourcing follow-up."
          />
        </div>
      </section>

      <section className="mt-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conversions</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PartsFinderStatCard label="Saved results" value={a.savedResults} />
          <PartsFinderStatCard label="Request sourcing" value={a.sourcingRequests} />
          <PartsFinderStatCard label="Chat starts" value={a.chatStarts} hint="OPEN_CHAT conversions when logged." />
          <PartsFinderStatCard label="Quote requests" value={a.quoteRequests} hint="REQUEST_QUOTE when wired from UI." />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <PartsFinderStatCard
            label="Search → sourcing"
            value={a.searchToSourcingConversionRate}
            suffix="%"
            hint="Sourcing requests ÷ total searches."
          />
          <PartsFinderStatCard
            label="Search → any conversion"
            value={a.searchToAnyConversionRate}
            suffix="%"
            hint="All conversion events ÷ total searches."
          />
          <PartsFinderStatCard
            label="Conversions per search"
            value={a.dashboardUsagePatterns.conversionsPerSearch}
            hint="Average conversion rows per search (global)."
          />
        </div>
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <RankedList
          title="Top vehicles (make · model · year)"
          rows={a.topSearchedVehicles}
          emptyHint="No labeled sessions yet. New searches populate these keys automatically."
        />
        <RankedList
          title="Top make / model"
          rows={a.topMakeModels}
          emptyHint="No make/model labels yet."
        />
        <RankedList
          title="Top part intents"
          rows={a.topSearchedParts}
          emptyHint="No part intent labels yet."
        />
        <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm dark:bg-white/[0.03]">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Session volume trend ({PARTS_FINDER_ANALYTICS_TREND_DAYS}d)
          </p>
          {a.sessionTrend.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No sessions in this window.</p>
          ) : (
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
              {a.sessionTrend.map((row) => (
                <li key={row.day} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{row.day}</span>
                  <span className="tabular-nums">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-muted/40 p-4 text-sm dark:bg-white/[0.03]">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Search vs conversion volume by day ({PARTS_FINDER_ANALYTICS_TREND_DAYS}d)
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Conversion events = sum of all Parts Finder conversion rows that day (sourcing, save, chat, quote, etc.).
        </p>
        {a.dailySearchVsConversions.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No activity in this window.</p>
        ) : (
          <div className="mt-2 max-h-48 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="py-1.5 pr-2 font-medium">Day</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Searches</th>
                  <th className="py-1.5 text-right font-medium">Conversion events</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {a.dailySearchVsConversions.map((row) => (
                  <tr key={row.day}>
                    <td className="py-1.5 pr-2 whitespace-nowrap text-muted-foreground">{row.day}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{row.searches}</td>
                    <td className="py-1.5 text-right tabular-nums">{row.conversionEvents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-border bg-muted/40 p-4 text-sm dark:bg-white/[0.03]">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Conversion trend by type ({PARTS_FINDER_ANALYTICS_TREND_DAYS}d)
        </p>
        {a.conversionTrend.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No conversions in this window.</p>
        ) : (
          <div className="mt-2 max-h-56 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="py-1.5 pr-2 font-medium">Day</th>
                  <th className="py-1.5 pr-2 font-medium">Type</th>
                  <th className="py-1.5 text-right font-medium">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {a.conversionTrend.map((row, idx) => (
                  <tr key={`${row.day}-${row.conversionType}-${idx}`}>
                    <td className="py-1.5 pr-2 whitespace-nowrap text-muted-foreground">{row.day}</td>
                    <td className="py-1.5 pr-2 font-mono">{row.conversionType}</td>
                    <td className="py-1.5 text-right tabular-nums">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
