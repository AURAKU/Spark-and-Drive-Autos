import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminPaymentsPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string" && value.length > 0) q.set(key, value);
  }
  const query = q.toString();
  redirect(query ? `/admin/payments/intelligence?${query}` : "/admin/payments/intelligence");
}
