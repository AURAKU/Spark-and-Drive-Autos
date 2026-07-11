import { listFxRatesData } from "@/actions/duty-admin-os";
import { DutyFxRatesClient } from "@/components/admin/duty-os/duty-fx-rates-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DutyFxRatesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const data = await listFxRatesData(sp);
  return <DutyFxRatesClient data={data} />;
}
