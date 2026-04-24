import Link from "next/link";

import { PartsFinderCtaLink } from "@/components/parts-finder/parts-finder-cta-link";
import { notFound, redirect } from "next/navigation";

import { PartsFinderResultCards } from "@/components/parts-finder/parts-finder-result-cards";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { getPartsFinderAccessSnapshot } from "@/lib/parts-finder/access";
import { getPartsFinderSessionForUser } from "@/lib/parts-finder/persistence";

export const dynamic = "force-dynamic";

export default async function PublicPartsFinderResultDetailPage(props: { params: Promise<{ id: string }> }) {
  const session = await requireSessionOrRedirect("/parts-finder/search");
  const access = await getPartsFinderAccessSnapshot();
  if (!access.allowResults) {
    redirect("/parts-finder/activate");
  }

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
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold">Parts Finder Result</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Session {id} · showing user-safe refined output only.
      </p>
      <div className="mt-6">
        <PartsFinderResultCards sessionId={id} results={safePayload.results} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <PartsFinderCtaLink href="/parts-finder/search" size="compact" className="!px-3.5">
          Find Parts
        </PartsFinderCtaLink>
        <Link href="/dashboard/parts-finder/searches" className="rounded-lg border border-border px-3 py-1.5 hover:bg-muted/40">
          Search history
        </Link>
      </div>
    </div>
  );
}
