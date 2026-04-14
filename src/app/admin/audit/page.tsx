import { PageHeading } from "@/components/typography/page-headings";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { normalizeIntelListPage } from "@/lib/ops";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readPage(sp: Record<string, string | string[] | undefined>, key: string): number {
  const v = sp[key];
  const s = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  if (s == null || s === "") return 1;
  const n = parseInt(s, 10);
  return normalizeIntelListPage(Number.isFinite(n) ? n : undefined);
}

const PAGE_SIZE = 15;

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const pageReq = readPage(sp, "page");
  const total = await prisma.auditLog.count();
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / PAGE_SIZE));
  const page = Math.min(Math.max(1, pageReq), totalPages);
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const pageHref = (nextPage: number) => (nextPage > 1 ? `/admin/audit?page=${nextPage}` : "/admin/audit");

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
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          itemLabel="Audit rows"
          prevHref={page > 1 ? pageHref(page - 1) : null}
          nextHref={page < totalPages ? pageHref(page + 1) : null}
        />
      ) : null}
    </div>
  );
}
