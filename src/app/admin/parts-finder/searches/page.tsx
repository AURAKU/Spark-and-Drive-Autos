import { redirect } from "next/navigation";

import { isAdminRole } from "@/auth";
import { safeAuth } from "@/lib/safe-auth";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminPartsFinderSearchesAliasPage(props: { searchParams: SearchParams }) {
  const session = await safeAuth();
  if (!session?.user?.role || !isAdminRole(session.user.role)) redirect("/dashboard");

  const sp = await props.searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string" && value.length > 0) query.set(key, value);
  }
  const qs = query.toString();
  redirect(`/admin/parts-finder/sessions${qs ? `?${qs}` : ""}`);
}
