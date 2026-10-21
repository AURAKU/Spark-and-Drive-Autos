import Link from "next/link";
import { redirect } from "next/navigation";

import { PublicPartsFinderSearch } from "@/components/parts-finder/public-parts-finder-search";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { getPartsFinderAccessSnapshot } from "@/lib/parts-finder/access";

export const dynamic = "force-dynamic";

export default async function PublicPartsFinderSearchPage() {
  await requireSessionOrRedirect("/parts-finder/search");
  const access = await getPartsFinderAccessSnapshot();
  if (!access.allowSearch) {
    redirect("/parts-finder/activate");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold">Find a part</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Type the part number or describe what you need. Adding the vehicle helps us match it.
      </p>
      <PublicPartsFinderSearch />
      <p className="mt-4 text-xs text-muted-foreground">Need help? Our team can review your search.</p>
      <p className="mt-2 text-sm">
        <Link href="/dashboard/parts-finder/searches" className="text-[var(--brand)] hover:underline">
          Search history
        </Link>
      </p>
    </div>
  );
}
