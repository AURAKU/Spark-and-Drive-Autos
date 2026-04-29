import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminVerificationsPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const q = new URLSearchParams();
  q.set("view", "verifications");
  for (const [key, value] of Object.entries(sp)) {
    if (key === "view") continue;
    if (typeof value === "string" && value.length > 0) q.set(key, value);
  }
  redirect(`/admin/parts-finder?${q.toString()}`);
}
