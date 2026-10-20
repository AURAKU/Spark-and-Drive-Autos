import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Document verification lives under Identity hub (merged with Ghana Card). */
export default async function AdminVerificationsRedirectPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const q = new URLSearchParams();
  q.set("tab", "documents");
  for (const [key, value] of Object.entries(sp)) {
    if (key === "view" || key === "tab") continue;
    if (typeof value === "string" && value.length > 0) q.set(key, value);
  }
  redirect(`/admin/identity?${q.toString()}`);
}
