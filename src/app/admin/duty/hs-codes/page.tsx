import { listHsCodesData } from "@/actions/duty-admin-os";
import { buildPageHref } from "@/lib/duty-admin/pagination";
import { ListPaginationFooter } from "@/components/ui/list-pagination";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DutyHsCodesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const data = await listHsCodesData(sp);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">HS codes, headings, and duty rate hints used for classification.</p>
      <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">HS code</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Rate hint</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr key={row.id} className="border-b border-border/50">
                <td className="px-3 py-2 font-mono">{row.hsCode}</td>
                <td className="px-3 py-2">{row.description}</td>
                <td className="px-3 py-2">{row.dutyRateHint != null ? `${Number(row.dutyRateHint) * 100}%` : "—"}</td>
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
        itemLabel="HS codes"
        prevHref={data.page > 1 ? buildPageHref("/admin/duty/hs-codes", data.page - 1) : null}
        nextHref={data.page < data.totalPages ? buildPageHref("/admin/duty/hs-codes", data.page + 1) : null}
      />
    </div>
  );
}
