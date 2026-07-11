import Link from "next/link";

import { getCustomerDutyHistory } from "@/actions/duty-calculator";
import { PageHeading } from "@/components/typography/page-headings";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { buildPageHref } from "@/lib/duty-admin/pagination";
import { formatMoney } from "@/lib/format";
import { requireActiveSessionOrRedirect } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardDutyHistoryPage({ searchParams }: { searchParams: SearchParams }) {
  await requireActiveSessionOrRedirect("/dashboard/duty/history");
  const sp = await searchParams;
  const page = typeof sp.page === "string" ? Math.max(1, Number(sp.page) || 1) : 1;
  const data = await getCustomerDutyHistory(page, 20);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeading variant="dashboard">Saved duty estimates</PageHeading>
        <Link href="/dashboard/duty" className="text-sm text-primary hover:underline">New estimate →</Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">Reference</th>
              <th className="px-3 py-2">Vehicle</th>
              <th className="px-3 py-2">HS</th>
              <th className="px-3 py-2">Est. duty</th>
              <th className="px-3 py-2">Landed</th>
              <th className="px-3 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No saved estimates yet.</td></tr>
            ) : (
              data.items.map((row) => {
                const input = row.inputJson as { vehicle?: { manufacturer?: string; model?: string } };
                const label = [input.vehicle?.manufacturer, input.vehicle?.model].filter(Boolean).join(" ");
                return (
                  <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2"><Link href={`/dashboard/duty/${row.id}`} className="font-mono text-primary hover:underline">{row.referenceNumber}</Link></td>
                    <td className="px-3 py-2">{label || "—"}</td>
                    <td className="px-3 py-2 font-mono">{row.hsCode ?? "—"}</td>
                    <td className="px-3 py-2">{row.predictedTotalGhs != null ? formatMoney(Number(row.predictedTotalGhs)) : "—"}</td>
                    <td className="px-3 py-2">{formatMoney(Number(row.totalLandedCostGhs))}</td>
                    <td className="px-3 py-2">{new Date(row.createdAt).toLocaleDateString()}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ListPaginationFooter
        page={page}
        pageSize={20}
        totalPages={data.totalPages}
        totalItems={data.totalItems}
        itemLabel="estimates"
        prevHref={page > 1 ? buildPageHref("/dashboard/duty/history", page - 1) : null}
        nextHref={page < data.totalPages ? buildPageHref("/dashboard/duty/history", page + 1) : null}
      />
    </div>
  );
}
