import Link from "next/link";

import { listVehicleProfilesData } from "@/actions/duty-admin-os";
import { buildPageHref } from "@/lib/duty-admin/pagination";
import { ListPaginationFooter } from "@/components/ui/list-pagination";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DutyProfilesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const data = await listVehicleProfilesData(sp);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Reusable vehicle classification profiles for estimates and assessments.</p>
      <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">Make / model</th>
              <th className="px-3 py-2">Year</th>
              <th className="px-3 py-2">HS</th>
              <th className="px-3 py-2">Fuel</th>
              <th className="px-3 py-2">Engine</th>
              <th className="px-3 py-2">Category</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((p) => (
              <tr key={p.id} className="border-b border-border/50">
                <td className="px-3 py-2">{p.make} {p.model}</td>
                <td className="px-3 py-2">{p.manufactureYear}</td>
                <td className="px-3 py-2 font-mono">{p.hsCode}</td>
                <td className="px-3 py-2">{p.fuelType}</td>
                <td className="px-3 py-2">{p.engineCc ?? "—"}</td>
                <td className="px-3 py-2">{p.vehicleCategory ?? "—"}</td>
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
        itemLabel="profiles"
        prevHref={data.page > 1 ? buildPageHref("/admin/duty/profiles", data.page - 1) : null}
        nextHref={data.page < data.totalPages ? buildPageHref("/admin/duty/profiles", data.page + 1) : null}
      />
      <p className="text-xs text-muted-foreground">
        Legacy formula/HS editing: <Link href="/admin/duty-intelligence" className="text-primary hover:underline">Duty Intelligence V3</Link> (being consolidated).
      </p>
    </div>
  );
}
