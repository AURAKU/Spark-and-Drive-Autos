import { redirect } from "next/navigation";

import { getPartsFinderAccessSnapshot } from "@/lib/parts-finder/access";
import { resolvePartsFinderEntryDestination } from "@/lib/parts-finder/entry-flow";

export const dynamic = "force-dynamic";

export default async function PartsFinderEntryPage() {
  const snapshot = await getPartsFinderAccessSnapshot();
  redirect(resolvePartsFinderEntryDestination(snapshot.state));
}
