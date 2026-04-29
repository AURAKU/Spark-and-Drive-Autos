import { redirect } from "next/navigation";

import { requireActiveSessionOrRedirect } from "@/lib/auth-helpers";

export default async function DashboardVerifiedPartsPage() {
  await requireActiveSessionOrRedirect("/dashboard/verified-parts");
  redirect("/dashboard/parts-finder?view=verified-parts");
}
