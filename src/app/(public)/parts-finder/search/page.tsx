import Link from "next/link";
import { redirect } from "next/navigation";

import { PublicPartsFinderSearch } from "@/components/parts-finder/public-parts-finder-search";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { getPartsFinderAccessSnapshot } from "@/lib/parts-finder/access";
import { PARTS_FINDER_HERO_LINE } from "@/lib/parts-finder/marketing-copy";

export const dynamic = "force-dynamic";

export default async function PublicPartsFinderSearchPage() {
  await requireSessionOrRedirect("/parts-finder/search");
  const access = await getPartsFinderAccessSnapshot();
  if (!access.allowSearch) {
    redirect("/parts-finder/activate");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold">Parts Finder Search</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{PARTS_FINDER_HERO_LINE}</p>
      <PublicPartsFinderSearch />
      <p className="mt-4 text-xs text-muted-foreground">
        Need full trace review? Admin can inspect internal evidence from the review console.
      </p>
      <p className="mt-2 text-sm">
        <Link href="/dashboard/parts-finder/searches" className="text-[var(--brand)] hover:underline">
          Open search history
        </Link>
      </p>
    </div>
  );
}
