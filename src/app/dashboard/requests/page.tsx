import { redirect } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const DEST = "/dashboard/inquiry-requests";

/**
 * @deprecated — merged into /dashboard/inquiry-requests
 */
export default async function DashboardRequestsRedirectPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const p = new URLSearchParams();
  const page = sp.page;
  if (typeof page === "string" && page !== "") p.set("page", page);
  const carPage = sp.carPage;
  if (typeof carPage === "string" && carPage !== "") p.set("carPage", carPage);
  const partPage = sp.partPage;
  if (typeof partPage === "string" && partPage !== "") p.set("partPage", partPage);
  const partsFinderSession = sp.partsFinderSession;
  if (typeof partsFinderSession === "string" && partsFinderSession !== "")
    p.set("partsFinderSession", partsFinderSession);
  const qs = p.toString();
  redirect(qs ? `${DEST}?${qs}#sourcing` : `${DEST}#sourcing`);
}
