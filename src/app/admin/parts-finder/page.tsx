import Link from "next/link";
import { redirect } from "next/navigation";

import { PartsFinderStatCard } from "@/components/parts-finder/parts-finder-stat-card";
import { PageHeading } from "@/components/typography/page-headings";
import { getPartsFinderAnalytics } from "@/lib/parts-finder/intelligence-analytics";
import { PARTS_FINDER_PRODUCT_NAME } from "@/lib/parts-finder/marketing-copy";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

import { isAdminRole } from "@/auth";

export const dynamic = "force-dynamic";

export default async function AdminPartsFinderOverviewPage() {
  const session = await safeAuth();
  if (!session?.user?.role || !isAdminRole(session.user.role)) redirect("/dashboard");

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
