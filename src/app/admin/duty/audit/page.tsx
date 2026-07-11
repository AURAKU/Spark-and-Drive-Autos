import { getDutyAdminAuditData } from "@/actions/duty-admin-os";
import { buildPageHref } from "@/lib/duty-admin/pagination";
import { ListPaginationFooter } from "@/components/ui/list-pagination";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DutyAuditPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const data = await getDutyAdminAuditData(sp);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Audit trail for duty rules, rates, assessments, and settings changes.</p>
      <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Entity</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr key={row.id} className="border-b border-border/50">
                <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">{row.actor?.email ?? "system"}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.action}</td>
                <td className="px-3 py-2">{row.entityType}{row.entityId ? ` · ${row.entityId.slice(0, 8)}` : ""}</td>
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
        itemLabel="audit events"
        prevHref={data.page > 1 ? buildPageHref("/admin/duty/audit", data.page - 1) : null}
        nextHref={data.page < data.totalPages ? buildPageHref("/admin/duty/audit", data.page + 1) : null}
      />
    </div>
  );
}
