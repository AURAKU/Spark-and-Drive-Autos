import { redirect } from "next/navigation";
import { requireActiveSessionOrRedirect } from "@/lib/auth-helpers";

export default async function DashboardGaragePage() {
  await requireActiveSessionOrRedirect("/dashboard/garage");
  redirect("/dashboard/parts-finder?view=garage");
}
