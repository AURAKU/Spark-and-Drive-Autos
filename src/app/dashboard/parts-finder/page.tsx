import { redirect } from "next/navigation";

import { PartsFinderMembershipPanel } from "@/components/parts-finder/parts-finder-membership-panel";
import { PageHeading } from "@/components/typography/page-headings";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { getPartsFinderUserDashboardStats } from "@/lib/parts-finder/dashboard-stats";
import { getPartsFinderAccessSnapshot } from "@/lib/parts-finder/access";
import { getPartsFinderActivationSnapshot } from "@/lib/parts-finder/pricing";

export const dynamic = "force-dynamic";

const DASHBOARD_TAGLINE =
  "Search engine — parts matching powered by external discovery and ranked confidence guidance.";

export default async function PartsFinderDashboardPage() {
  const session = await requireSessionOrRedirect("/dashboard/parts-finder");
  const access = await getPartsFinderAccessSnapshot();
  if (access.state === "UPSELL_ONLY") redirect("/parts-finder");

  const [pricing, stats] = await Promise.all([
    getPartsFinderActivationSnapshot(),
    getPartsFinderUserDashboardStats(session.user.id),
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
      <div className="mt-8">
        <PartsFinderMembershipPanel initial={initial} />
      </div>
    </div>
  );
}
