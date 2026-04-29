import { redirect } from "next/navigation";

import { getPartsFinderAccessSnapshot } from "@/lib/parts-finder/access";
import { resolvePartsFinderEntryDestination } from "@/lib/parts-finder/entry-flow";

export const dynamic = "force-dynamic";

export default async function PartsFinderEntryPage() {
  const snapshot = await getPartsFinderAccessSnapshot().catch((error) => {
    console.error("[parts-finder/entry] failed to get access snapshot", error);
    return null;
  });

  if (!snapshot?.state) {
    console.error("[parts-finder/entry] missing access snapshot state", snapshot);
    redirect("/parts-finder?status=entry-unavailable");
  }

  const destination = resolvePartsFinderEntryDestination(snapshot.state);

  if (!destination || typeof destination !== "string") {
    console.error("[parts-finder/entry] invalid destination", {
      state: snapshot.state,
      destination,
    });
    redirect("/parts-finder?status=entry-unavailable");
  }

  redirect(destination);
}