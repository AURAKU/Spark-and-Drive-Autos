import { redirect } from "next/navigation";
import Link from "next/link";

import { PartsFinderMembershipPanel } from "@/components/parts-finder/parts-finder-membership-panel";
import { PageHeading } from "@/components/typography/page-headings";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { getPartsFinderUserDashboardStats } from "@/lib/parts-finder/dashboard-stats";
import { getPartsFinderAccessSnapshot } from "@/lib/parts-finder/access";
import { getPartsFinderActivationSnapshot } from "@/lib/parts-finder/pricing";
import { GarageClient } from "@/app/dashboard/garage/garage-client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DASHBOARD_TAGLINE =
  "Search engine — parts matching powered by external discovery and ranked confidence guidance.";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstQueryValue(sp: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.find((x): x is string => typeof x === "string");
  return undefined;
}

type HubView = "parts-finder" | "garage" | "verified-parts";

function parseHubView(raw: string | undefined): HubView {
  if (raw === "garage" || raw === "verified-parts") return raw;
  return "parts-finder";
}

export default async function PartsFinderDashboardPage(props: { searchParams: SearchParams }) {
  const session = await requireSessionOrRedirect("/dashboard/parts-finder");
  const sp = await props.searchParams;
  const view = parseHubView(firstQueryValue(sp, "view"));
  const access = await getPartsFinderAccessSnapshot();
  if (access.state === "UPSELL_ONLY") redirect("/parts-finder");

  const [pricing, stats, verifiedRows] = await Promise.all([
    getPartsFinderActivationSnapshot(),
    getPartsFinderUserDashboardStats(session.user.id),
    prisma.verifiedPartRequest.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: { payment: { select: { status: true } } },
    }),
  ]);

  const initial = {
    access,
    pricing,
    stats,
    serverTime: new Date().toISOString(),
  };

  return (
    <div>
      <PageHeading variant="dashboard">Spark Parts Finder</PageHeading>
      <p className="mt-2 max-w-2xl text-sm text-zinc-400">{DASHBOARD_TAGLINE}</p>
      <div className="mt-6 inline-flex rounded-xl border border-border bg-muted/40 p-1 dark:border-white/10 dark:bg-white/[0.03]">
        {[
          { key: "parts-finder" as const, label: "Parts Finder" },
          { key: "garage" as const, label: "My Garage" },
          { key: "verified-parts" as const, label: "Verified Parts" },
        ].map((item) => {
          const active = item.key === view;
          return (
            <Link
              key={item.key}
              href={`/dashboard/parts-finder?view=${item.key}`}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                active
                  ? "bg-[var(--brand)] text-black font-semibold"
                  : "text-muted-foreground hover:bg-background hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="mt-8">
        {view === "parts-finder" ? <PartsFinderMembershipPanel initial={initial} /> : null}
        {view === "garage" ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">My Garage</h2>
              <p className="text-sm text-muted-foreground">
                Save your vehicles once, then run faster and more accurate parts searches.
              </p>
            </div>
            <GarageClient />
          </div>
        ) : null}
        {view === "verified-parts" ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Verified Part Requests</h2>
              <p className="text-sm text-muted-foreground">Paid verification and sourcing-support requests.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              {verifiedRows.length === 0 ? <p className="text-sm text-muted-foreground">No verified part requests yet.</p> : null}
              <div className="space-y-2">
                {verifiedRows.map((row) => (
                  <Link
                    key={row.id}
                    href={`/dashboard/verified-parts/${row.id}`}
                    className="flex items-center justify-between rounded-lg border border-border bg-background p-3 hover:bg-muted/30"
                  >
                    <div>
                      <p className="text-sm font-semibold">{row.requestNumber}</p>
                      <p className="text-xs text-muted-foreground">{row.partName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium">{row.status.replaceAll("_", " ")}</p>
                      <p className="text-[11px] text-muted-foreground">Payment: {row.payment?.status ?? "PENDING"}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
