import Link from "next/link";
import { redirect } from "next/navigation";

import { PartsFinderStatCard } from "@/components/parts-finder/parts-finder-stat-card";
import { PageHeading } from "@/components/typography/page-headings";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { buildListPageMeta, listPageNav, readListPage } from "@/lib/list-page";
import { getPartsFinderAnalytics } from "@/lib/parts-finder/intelligence-analytics";
import { PARTS_FINDER_PRODUCT_NAME } from "@/lib/parts-finder/marketing-copy";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

import { isAdminRole } from "@/auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 20;

type PartsFinderView = "overview" | "verified-parts";

function readView(sp: Record<string, string | string[] | undefined>): PartsFinderView {
  const v = sp.view;
  const s = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  if (s === "verifications") {
    // Identity document reviews moved to Identity hub (with Ghana Card).
    redirect("/admin/identity?tab=documents");
  }
  if (s === "verified-parts") return "verified-parts";
  return "overview";
}

export default async function AdminPartsFinderOverviewPage(props: { searchParams: SearchParams }) {
  const session = await safeAuth();
  if (!session?.user?.role || !isAdminRole(session.user.role)) redirect("/dashboard");

  const sp = await props.searchParams;
  const view = readView(sp);

  if (view === "overview") {
    const [analytics, membershipPayments] = await Promise.all([
      getPartsFinderAnalytics(),
      prisma.payment.count({
        where: { paymentType: "PARTS_FINDER_MEMBERSHIP", status: "SUCCESS" },
      }),
    ]);

    return (
      <div>
        <PageHeading variant="dashboard">{PARTS_FINDER_PRODUCT_NAME} · Admin</PageHeading>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage activation performance, review queue, and search telemetry for premium parts matching.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <PartsFinderStatCard label="Successful activations" value={membershipPayments} />
          <PartsFinderStatCard
            label="Operational load"
            value={analytics.totalSearches + analytics.membership.pendingSearchReviews}
            hint="Total searches plus sessions awaiting review."
          />
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          <Link href="/admin/parts-finder/analytics" className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/40">
            Analytics
          </Link>
          <Link href="/admin/parts-finder/settings" className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/40">
            Settings
          </Link>
          <Link href="/admin/parts-finder/parts-request-fee" className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/40">
            Parts request fee
          </Link>
          <Link href="/admin/parts-finder/memberships" className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/40">
            Memberships
          </Link>
          <Link href="/admin/parts-finder/searches" className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/40">
            Searches
          </Link>
        </div>
      </div>
    );
  }

  const total = await prisma.verifiedPartRequest.count();
  const meta = buildListPageMeta(total, PAGE_SIZE, readListPage(sp));
  const nav = listPageNav("/admin/parts-finder", { ...sp, view: "verified-parts" }, meta);

  const verifiedRows = await prisma.verifiedPartRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      payment: { select: { status: true } },
      assignedAdmin: { select: { name: true, email: true } },
    },
    skip: meta.skip,
    take: PAGE_SIZE,
  });

  return (
    <div className="space-y-4">
      <PageHeading variant="dashboard">Verified part requests</PageHeading>
      <p className="mt-2 text-sm text-muted-foreground">Review and fulfill premium verified parts workflows.</p>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="space-y-2">
          {verifiedRows.map((row) => (
            <Link
              key={row.id}
              href={`/admin/verified-parts/${row.id}`}
              className="flex items-center justify-between rounded-lg border border-border bg-background p-3 hover:bg-muted/30"
            >
              <div>
                <p className="text-sm font-semibold">{row.requestNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {row.user.name ?? row.user.email} · {row.partName}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium">{row.status.replaceAll("_", " ")}</p>
                <p className="text-[11px] text-muted-foreground">Payment: {row.payment?.status ?? "PENDING"}</p>
              </div>
            </Link>
          ))}
          {verifiedRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No verified part requests yet.</p>
          ) : null}
        </div>
      </div>
      {total > 0 ? (
        <ListPaginationFooter
          {...nav}
          page={meta.page}
          totalPages={meta.totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          itemLabel="Verified requests"
          showPerPageNote
        />
      ) : null}
    </div>
  );
}
