import Link from "next/link";

import { MotorcycleInventoryRowActions } from "@/components/admin/motorcycles/motorcycle-inventory-row-actions";
import { PageHeading } from "@/components/typography/page-headings";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { formatVehiclePriceFromRmb, getGlobalCurrencySettings } from "@/lib/currency";
import { normalizeIntelListPage } from "@/lib/ops";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 15;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminMotorcyclesPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const pageReq = normalizeIntelListPage(parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);
  const where = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { brand: { contains: q, mode: "insensitive" as const } },
          { model: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};
  const total = await prisma.motorcycle.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, pageReq), totalPages);
  const fx = await getGlobalCurrencySettings();
  const rows = await prisma.motorcycle.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const stats = await prisma.motorcycle.groupBy({
    by: ["listingState"],
    _count: true,
  });

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/admin/motorcycles?${qs}` : "/admin/motorcycles";
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <PageHeading variant="dashboard">Motorcycle Inventory</PageHeading>
          <p className="mt-1 text-sm text-muted-foreground">{total} listings · {stats.map((s) => `${s.listingState}: ${s._count}`).join(" · ")}</p>
        </div>
        <Link href="/admin/motorcycles/new" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Add motorcycle</Link>
      </div>

      <form className="flex gap-2" action="/admin/motorcycles" method="get">
        <input name="q" defaultValue={q} placeholder="Search…" className="rounded-lg border border-border px-3 py-2 text-sm dark:border-white/15 dark:bg-black/40" />
        <button type="submit" className="rounded-lg border border-border px-4 py-2 text-sm">Search</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="p-3">Title</th>
              <th className="p-3">Type</th>
              <th className="p-3">State</th>
              <th className="p-3">Price</th>
              <th className="p-3">Views</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-b border-border/50">
                <td className="p-3 font-medium">{m.title}</td>
                <td className="p-3">{m.motorcycleType.replace(/_/g, " ")}</td>
                <td className="p-3">{m.listingState}</td>
                <td className="p-3">{formatVehiclePriceFromRmb(Number(m.basePriceRmb), "GHS", fx)}</td>
                <td className="p-3">{m.viewCount}</td>
                <td className="p-3">
                  <MotorcycleInventoryRowActions id={m.id} slug={m.slug} listingState={m.listingState} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ListPaginationFooter
        page={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={PAGE_SIZE}
        itemLabel="Listings"
        prevHref={page > 1 ? pageHref(page - 1) : null}
        nextHref={page < totalPages ? pageHref(page + 1) : null}
        pageHrefs={totalPages > 1 ? Array.from({ length: totalPages }, (_, i) => pageHref(i + 1)) : undefined}
      />
    </div>
  );
}
