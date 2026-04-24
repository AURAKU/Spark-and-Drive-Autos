import { redirect } from "next/navigation";

import { isAdminRole } from "@/auth";
import { safeAuth } from "@/lib/safe-auth";

type Params = Promise<{ id: string }>;

export default async function AdminPartsFinderReviewAliasPage(props: { params: Params }) {
  const session = await safeAuth();
  if (!session?.user?.role || !isAdminRole(session.user.role)) redirect("/dashboard");

  const { id } = await props.params;
  redirect(`/admin/parts-finder/sessions/${encodeURIComponent(id)}`);
}
