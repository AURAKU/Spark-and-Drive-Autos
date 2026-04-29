import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminVerifiedPartsPage() {
  redirect("/admin/parts-finder?view=verified-parts");
}
