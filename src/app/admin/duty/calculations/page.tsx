import Link from "next/link";

import { getDutyAdminCalculationsData } from "@/actions/duty-admin-os";
import { buildPageHref } from "@/lib/duty-admin/pagination";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DutyCalculationsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const data = await getDutyAdminCalculationsData(sp);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Immutable saved duty estimates with formula and rule-set snapshots.</p>
      <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">Reference</th>
              <th className="px-3 py-2">HS</th>
              <th className="px-3 py-2">Predicted</th>
              <th className="px-3 py-2">Range</th>
              <th className="px-3 py-2">Confidence</th>
              <th className="px-3 py-2">Formula</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr key={row.id} className="border-b border-border/50">
                <td className="px-3 py-2">
                  <Link href={`/admin/duty/calculations/${row.id}`} className="font-mono text-primary hover:underline">{row.referenceNumber}</Link>
                </td>
                <td className="px-3 py-2 font-mono">{row.hsCode}</td>
                <td className="px-3 py-2">{row.predictedTotalGhs != null ? formatMoney(Number(row.predictedTotalGhs)) : "—"}</td>
                <td className="px-3 py-2 text-xs">
                  {row.predictedLowGhs != null && row.predictedHighGhs != null
                    ? `${formatMoney(Number(row.predictedLowGhs))} – ${formatMoney(Number(row.predictedHighGhs))}`
                    : "—"}
                </td>
                <td className="px-3 py-2">{row.confidenceLevel ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{row.formulaVersion}</td>
                <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ListPaginationFooter
        page={data.page}
        pageSize={data.pageSize}
        totalPages={data.totalPages}
        totalItems={data.totalItems}
        itemLabel="calculations"
        prevHref={data.page > 1 ? buildPageHref("/admin/duty/calculations", data.page - 1) : null}
        nextHref={data.page < data.totalPages ? buildPageHref("/admin/duty/calculations", data.page + 1) : null}
      />
    </div>
  );
}
