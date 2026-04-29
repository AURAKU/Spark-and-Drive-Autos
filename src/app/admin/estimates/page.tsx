import { AdminEstimatesHub } from "@/components/admin/admin-estimates-hub";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminEstimatesPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  return <AdminEstimatesHub searchParams={sp} pathname="/admin/estimates" />;
}
