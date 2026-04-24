import { notFound } from "next/navigation";

import { PartsFinderResultCards } from "@/components/parts-finder/parts-finder-result-cards";
import { PageHeading } from "@/components/typography/page-headings";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { assertPartsFinderAccess } from "@/lib/parts-finder/access";
import { getPartsFinderSessionForUser } from "@/lib/parts-finder/persistence";

export const dynamic = "force-dynamic";

export default async function PartsFinderSearchDetailPage(props: { params: Promise<{ id: string }> }) {
  await requireSessionOrRedirect("/dashboard/parts-finder/searches");
  const { session } = await assertPartsFinderAccess("RESULTS");
  const { id } = await props.params;
  const row = await getPartsFinderSessionForUser(id, session.user.id);
  if (!row) notFound();
  const meta = (row.metadataJson ?? {}) as Record<string, unknown>;
  const safePayload = {
    summary: meta.summary ?? null,
    confidence: meta.confidence ?? null,
    review: meta.review ?? null,
    results: meta.results ?? [],
  };

  return (
    <div>
      <PageHeading variant="dashboard">Search detail</PageHeading>
      <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4 text-sm dark:bg-white/[0.02]">
        <p className="font-medium text-foreground">{row.action}</p>
        <p className="mt-1 text-xs text-muted-foreground">{row.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC</p>
        <div className="mt-3">
          <PartsFinderResultCards sessionId={id} results={safePayload.results} />
        </div>
      </div>
    </div>
  );
}
