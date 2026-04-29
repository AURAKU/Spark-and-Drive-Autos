import { redirect } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function VehicleImportEstimateIndexPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const q = new URLSearchParams();
  q.set("dutySection", "estimates");
  for (const [key, value] of Object.entries(sp)) {
    if (key === "dutySection") continue;
    if (typeof value === "string" && value.length > 0) q.set(key, value);
  }
  redirect(`/admin/duty?${q.toString()}`);
}
