import { getDutyAdminRulesData } from "@/actions/duty-admin-os";
import { DutyRulesClient } from "@/components/admin/duty-os/duty-rules-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DutyRulesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const data = await getDutyAdminRulesData(sp);
  return <DutyRulesClient data={data} />;
}
