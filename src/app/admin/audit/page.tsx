import { PageHeading } from "@/components/typography/page-headings";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { buildListPageMeta, listPageNav, readListPage } from "@/lib/list-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 25;

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const total = await prisma.auditLog.count();
  const meta = buildListPageMeta(total, PAGE_SIZE, readListPage(sp));
  const nav = listPageNav("/admin/audit", sp, meta);
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    skip: meta.skip,
    take: PAGE_SIZE,
  });

  return (
    <div>
      <PageHeading variant="dashboard">Audit log</PageHeading>
      <div className="mt-8 space-y-2 text-xs text-zinc-400">
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 font-mono">
            {r.createdAt.toISOString()} · {r.action} · {r.entityType} · {r.entityId ?? "—"}
          </div>
        ))}
      </div>
      {total > 0 ? (
        <ListPaginationFooter
          {...nav}
          page={meta.page}
          totalPages={meta.totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          itemLabel="Audit rows"
        />
      ) : null}
    </div>
  );
}
