import Link from "next/link";

import { PageHeading } from "@/components/typography/page-headings";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { assertPartsFinderAccess } from "@/lib/parts-finder/access";
import { listPartsFinderSessionsForUser } from "@/lib/parts-finder/persistence";

export const dynamic = "force-dynamic";

export default async function PartsFinderSearchHistoryPage() {
  await requireSessionOrRedirect("/dashboard/parts-finder/searches");
  const { session } = await assertPartsFinderAccess("RESULTS");
  const rows = await listPartsFinderSessionsForUser(session.user.id, 40);

  return (
    <div>
      <PageHeading variant="dashboard">Parts Finder search history</PageHeading>
      <div className="mt-6 space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Parts Finder events yet.</p>
        ) : (
          rows.map((row) => (
            <Link key={row.id} href={`/dashboard/parts-finder/searches/${row.entityId ?? row.id}`} className="block rounded-xl border border-border bg-muted/30 p-3 text-sm hover:bg-muted/50 dark:bg-white/[0.02]">
              <p className="font-medium text-foreground">{row.entityId ?? row.id}</p>
              <p className="mt-1 text-xs text-muted-foreground">{row.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC</p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
