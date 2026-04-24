import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeading } from "@/components/typography/page-headings";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { PARTS_FINDER_PRODUCT_NAME } from "@/lib/parts-finder/marketing-copy";
import { normalizeIntelListPage } from "@/lib/ops";
import { listQueuedPartsFinderReviews } from "@/lib/parts-finder/persistence";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

import { isAdminRole } from "@/auth";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 15;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readPage(sp: Record<string, string | string[] | undefined>, key: string): number {
  const v = sp[key];
  const s = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  if (s == null || s === "") return 1;
  const n = parseInt(s, 10);
  return normalizeIntelListPage(Number.isFinite(n) ? n : undefined);
}

export default async function AdminPartsFinderSessionsPage(props: { searchParams: SearchParams }) {
  const session = await safeAuth();
  if (!session?.user?.role || !isAdminRole(session.user.role)) redirect("/dashboard");
  const sp = await props.searchParams;
  const pageReq = readPage(sp, "page");
  const statusFilter =
    typeof sp.status === "string" &&
    ["PENDING_REVIEW", "LOW_CONFIDENCE", "VERIFIED", "LIKELY", "APPROVED", "REJECTED", "FLAGGED_SOURCING"].includes(sp.status)
      ? sp.status
      : "ALL";

  const where = statusFilter === "ALL" ? {} : { status: statusFilter as never };
  const [total, triageCounts] = await Promise.all([
    prisma.partsFinderSearchSession.count({ where }),
    prisma.partsFinderSearchSession.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / PAGE_SIZE));
  const page = Math.min(Math.max(1, pageReq), totalPages);
  const rows = await prisma.partsFinderSearchSession.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      sessionId: true,
      status: true,
      createdAt: true,
      analyticsVehicleLabel: true,
      analyticsPartIntentLabel: true,
      confidenceLabel: true,
      confidenceScore: true,
      summaryJson: true,
      user: { select: { email: true, name: true } },
      _count: { select: { results: true, conversions: true } },
    },
  });
  const queued = await listQueuedPartsFinderReviews(200);
  const countMap = new Map(triageCounts.map((row) => [row.status, row._count._all]));
  const pageHref = (nextPage: number) =>
    nextPage > 1
      ? `/admin/parts-finder/sessions?page=${nextPage}${statusFilter !== "ALL" ? `&status=${statusFilter}` : ""}`
      : `/admin/parts-finder/sessions${statusFilter !== "ALL" ? `?status=${statusFilter}` : ""}`;

  return (
    <div>
      <PageHeading variant="dashboard">{PARTS_FINDER_PRODUCT_NAME} · Search sessions</PageHeading>
      <p className="mt-2 text-sm text-muted-foreground">
        Operational session timeline from persisted Parts Finder search sessions.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Review queue volume: <span className="font-semibold text-foreground">{queued.length}</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Includes confidence class, uncertainty notes, and conversion signal to help triage high-value or risky sessions quickly.
      </p>
      <p className="mt-4 text-sm">
        <Link href="/admin/parts-finder" className="text-[var(--brand)] hover:underline">
          ← Analytics overview
        </Link>
        {" · "}
        <Link href="/admin/parts-finder/memberships" className="text-[var(--brand)] hover:underline">
          Membership operations
        </Link>
      </p>
      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-background/40 px-3 py-2">Pending review: <span className="font-semibold">{countMap.get("PENDING_REVIEW") ?? 0}</span></div>
        <div className="rounded-lg border border-border bg-background/40 px-3 py-2">Low confidence: <span className="font-semibold">{countMap.get("LOW_CONFIDENCE") ?? 0}</span></div>
        <div className="rounded-lg border border-border bg-background/40 px-3 py-2">Verified: <span className="font-semibold">{countMap.get("VERIFIED") ?? 0}</span></div>
        <div className="rounded-lg border border-border bg-background/40 px-3 py-2">Flagged sourcing: <span className="font-semibold">{countMap.get("FLAGGED_SOURCING") ?? 0}</span></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <Link href="/admin/parts-finder/sessions" className="rounded-md border border-border px-2 py-1 hover:bg-muted/40">All</Link>
        <Link href="/admin/parts-finder/sessions?status=PENDING_REVIEW" className="rounded-md border border-border px-2 py-1 hover:bg-muted/40">Pending</Link>
        <Link href="/admin/parts-finder/sessions?status=LOW_CONFIDENCE" className="rounded-md border border-border px-2 py-1 hover:bg-muted/40">Low confidence</Link>
        <Link href="/admin/parts-finder/sessions?status=VERIFIED" className="rounded-md border border-border px-2 py-1 hover:bg-muted/40">Verified</Link>
        <Link href="/admin/parts-finder/sessions?status=FLAGGED_SOURCING" className="rounded-md border border-border px-2 py-1 hover:bg-muted/40">Sourcing flags</Link>
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">When (UTC)</th>
              <th className="px-4 py-3 font-medium">Vehicle / part intent</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Entity</th>
              <th className="px-4 py-3 font-medium">Result count</th>
              <th className="px-4 py-3 font-medium">Conversions</th>
              <th className="px-4 py-3 font-medium">Confidence</th>
              <th className="px-4 py-3 font-medium">Uncertainty reason</th>
              <th className="px-4 py-3 font-medium">Review status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-muted-foreground" colSpan={10}>
                  No Parts Finder sessions logged yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="bg-background/40">
                  {(() => {
                    const summaryRecord =
                      row.summaryJson && typeof row.summaryJson === "object"
                        ? (row.summaryJson as Record<string, unknown>)
                        : {};
                    const uncertaintyNotes = Array.isArray(summaryRecord.uncertaintyNotes)
                      ? summaryRecord.uncertaintyNotes.map((note) => String(note))
                      : [];
                    const uncertaintyReason =
                      uncertaintyNotes.length > 0 ? uncertaintyNotes[0] : row.status === "PENDING_REVIEW" ? "Awaiting admin review." : "—";
                    return (
                      <>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {row.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="max-w-52 truncate text-xs text-foreground">
                      {row.analyticsVehicleLabel ?? "Vehicle not fully labeled"}
                    </p>
                    <p className="max-w-52 truncate text-[11px] text-muted-foreground">
                      {row.analyticsPartIntentLabel ?? "Part intent unlabeled"}
                    </p>
                  </td>
                  <td className="px-4 py-3">{row.user?.email ?? row.user?.name ?? "System"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    PartsFinderSession:{row.sessionId}
                  </td>
                  <td className="px-4 py-3">{row._count.results}</td>
                  <td className="px-4 py-3">{row._count.conversions}</td>
                  <td className="px-4 py-3">
                    {row.confidenceLabel ?? "—"} {row.confidenceScore != null ? `(${row.confidenceScore}%)` : ""}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{uncertaintyReason}</td>
                  <td className="px-4 py-3">{row.status}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/parts-finder/review/${row.sessionId}`} className="text-[var(--brand)] hover:underline">
                      Review
                    </Link>
                  </td>
                      </>
                    );
                  })()}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {total > 0 ? (
        <ListPaginationFooter
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          itemLabel="Session events"
          prevHref={page > 1 ? pageHref(page - 1) : null}
          nextHref={page < totalPages ? pageHref(page + 1) : null}
        />
      ) : null}
    </div>
  );
}
