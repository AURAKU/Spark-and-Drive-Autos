import { redirect } from "next/navigation";
import { requireActiveSessionOrRedirect } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export default async function DashboardVerificationPage() {
  await requireActiveSessionOrRedirect("/dashboard/verification");
  redirect("/dashboard/profile?view=verification");
}
