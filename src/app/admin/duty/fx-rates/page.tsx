import { listFxRatesData } from "@/actions/duty-admin-os";
import { buildPageHref } from "@/lib/duty-admin/pagination";
import { ListPaginationFooter } from "@/components/ui/list-pagination";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DutyFxRatesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const data = await listFxRatesData(sp);
  const staleMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Dated exchange rates with source. Manual overrides require audit. Old calculations preserve snapshot FX — never retroactive.
      </p>
      <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">Pair</th>
              <th className="px-3 py-2">Rate</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Effective</th>
              <th className="px-3 py-2">Override</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => {
              const stale = now - row.effectiveDate.getTime() > staleMs;
              return (
                <tr key={row.id} className="border-b border-border/50">
                  <td className="px-3 py-2 font-mono">{row.fromCurrency}/{row.toCurrency}</td>
                  <td className="px-3 py-2">{Number(row.rate)}</td>
                  <td className="px-3 py-2">{row.source}{stale ? " · stale" : ""}</td>
                  <td className="px-3 py-2">{row.effectiveDate.toLocaleDateString()}</td>
                  <td className="px-3 py-2">{row.isOverride ? "Yes" : "No"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ListPaginationFooter
        page={data.page}
        pageSize={data.pageSize}
        totalPages={data.totalPages}
        totalItems={data.totalItems}
        itemLabel="FX rates"
        prevHref={data.page > 1 ? buildPageHref("/admin/duty/fx-rates", data.page - 1) : null}
        nextHref={data.page < data.totalPages ? buildPageHref("/admin/duty/fx-rates", data.page + 1) : null}
      />
    </div>
  );
}
