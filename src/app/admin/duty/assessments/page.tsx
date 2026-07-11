import Link from "next/link";

import { getDutyAdminAssessmentsData } from "@/actions/duty-admin-os";
import { buildPageHref } from "@/lib/duty-admin/pagination";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DutyAssessmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const data = await getDutyAdminAssessmentsData(sp);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Verified Bills of Entry and customs assessments.</p>
        <Link href="/admin/duty/assessments/import" className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
          Import assessment
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2">BoE ref</th>
              <th className="px-3 py-2">Vehicle</th>
              <th className="px-3 py-2">HS</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr key={row.id} className="border-b border-border/50">
                <td className="px-3 py-2">
                  <Link href={`/admin/duty/assessments/${row.id}`} className="font-mono text-primary hover:underline">
                    {row.billOfEntryNumber ?? row.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-3 py-2">{row.make} {row.model}</td>
                <td className="px-3 py-2 font-mono">{row.hsCode}</td>
                <td className="px-3 py-2">{formatMoney(row.totalAssessedGhs)}</td>
                <td className="px-3 py-2">{row.verificationStatus}</td>
                <td className="px-3 py-2">{row.assessmentDate ? new Date(row.assessmentDate).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ListPaginationFooter
        page={data.page ?? 1}
        pageSize={data.pageSize ?? 20}
        totalPages={data.totalPages}
        totalItems={data.totalItems}
        itemLabel="assessments"
        prevHref={(data.page ?? 1) > 1 ? buildPageHref("/admin/duty/assessments", (data.page ?? 1) - 1) : null}
        nextHref={(data.page ?? 1) < data.totalPages ? buildPageHref("/admin/duty/assessments", (data.page ?? 1) + 1) : null}
      />
    </div>
  );
}
