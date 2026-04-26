import { redirect } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const DEST = "/dashboard/inquiry-requests";

/**
 * @deprecated — merged into /dashboard/inquiry-requests
 */
export default async function DashboardInquiriesRedirectPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const p = new URLSearchParams();
  const page = sp.page;
  if (typeof page === "string" && page !== "") p.set("page", page);
  const partsFinderSession = sp.partsFinderSession;
  if (typeof partsFinderSession === "string" && partsFinderSession !== "")
    p.set("partsFinderSession", partsFinderSession);
  if (sp.carPage != null) {
    const v = sp.carPage;
    const s = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
    if (s) p.set("carPage", s);
  }
  if (sp.partPage != null) {
    const v = sp.partPage;
    const s = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
    if (s) p.set("partPage", s);
  }
  const qs = p.toString();
  redirect(qs ? `${DEST}?${qs}#inquiries` : `${DEST}#inquiries`);
}
