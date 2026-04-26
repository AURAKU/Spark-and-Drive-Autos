import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { BulkInventoryHub, type BulkInventoryRow } from "@/components/admin/bulk-inventory-hub";
import { PageHeading } from "@/components/typography/page-headings";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { normalizeIntelListPage } from "@/lib/ops";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parseInventory(raw: string | undefined): "cars" | "parts" {
  return raw === "parts" ? "parts" : "cars";
}

function parseSort(raw: string | undefined): "updated" | "title" {
  return raw === "title" ? "title" : "updated";
}

function parsePage(raw: string | undefined) {
  const n = Number.parseInt(raw ?? "1", 10);
  return normalizeIntelListPage(Number.isFinite(n) ? n : undefined);
}

export default async function AdminBulkImportExportPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const inventory = parseInventory(typeof sp.inventory === "string" ? sp.inventory : undefined);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const sort = parseSort(typeof sp.sort === "string" ? sp.sort : undefined);
  const reqPage = parsePage(typeof sp.page === "string" ? sp.page : undefined);

  const [recentImports, recentExports] = await Promise.all([
    prisma.importJob.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
    prisma.exportJob.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const importRows = recentImports.map((j) => ({
    id: j.id,
    entity: j.entity,
    status: j.status,
    summary: j.summary,
  }));

  let rows: BulkInventoryRow[] = [];
  let totalCount = 0;
  let page = 1;
  let totalPages = 1;
  const pageHref = (p: number) =>
    `/admin/import-export?inventory=${inventory}${q ? `&q=${encodeURIComponent(q)}` : ""}${sort !== "updated" ? `&sort=${sort}` : ""}${p > 1 ? `&page=${p}` : ""}`;

  if (inventory === "cars") {
    const where: Prisma.CarWhereInput = q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { brand: { contains: q, mode: "insensitive" } },
            { model: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};
    const orderBy = sort === "title" ? { title: "asc" as const } : { updatedAt: "desc" as const };
    const count = await prisma.car.count({ where });
    totalCount = count;
    totalPages = Math.max(1, Math.ceil(Math.max(0, count) / PAGE_SIZE));
    page = Math.min(Math.max(1, reqPage), totalPages);
    const list = await prisma.car.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        title: true,
        brand: true,
        model: true,
        year: true,
        listingState: true,
        updatedAt: true,
      },
    });
    rows = list.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      meta: `${c.brand} ${c.model} · ${c.year} · ${c.listingState}`,
      updatedAt: c.updatedAt.toISOString(),
    }));
  } else {
    const where: Prisma.PartWhereInput = q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};
    const orderBy = sort === "title" ? { title: "asc" as const } : { updatedAt: "desc" as const };
    const count = await prisma.part.count({ where });
    totalCount = count;
    totalPages = Math.max(1, Math.ceil(Math.max(0, count) / PAGE_SIZE));
    page = Math.min(Math.max(1, reqPage), totalPages);
    const list = await prisma.part.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        origin: true,
        listingState: true,
        stockQty: true,
        updatedAt: true,
      },
    });
    rows = list.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      meta: `${p.category} · ${p.origin} · stock ${p.stockQty} · ${p.listingState}`,
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  return (
    <div>
      <PageHeading variant="dashboard">BULK Imports &amp; Export Inventory</PageHeading>
      <p className="mt-2 max-w-3xl text-sm text-zinc-400">
        One place to compile <strong className="text-zinc-300">vehicles</strong> or <strong className="text-zinc-300">parts</strong>{" "}
        using the same CSV columns the APIs use. Search and sort, select rows (or export the whole filtered list), download
        templates, and import updates or new rows. Excel opens CSV directly; keep UTF-8 when saving.
      </p>
      <p className="mt-2 text-sm text-zinc-500">
        Linked inventories:{" "}
        <Link href="/admin/cars" className="text-[var(--brand)] hover:underline">
          Cars inventory
        </Link>
        {" · "}
        <Link href="/admin/parts" className="text-[var(--brand)] hover:underline">
          Parts management
        </Link>
      </p>

      <div className="mt-8">
        <BulkInventoryHub
          inventory={inventory}
          rows={rows}
          totalCount={totalCount}
          page={page}
          totalPages={totalPages}
          q={q}
          sort={sort}
          recentImports={importRows}
        />
      </div>
      {totalCount > 0 ? (
        <ListPaginationFooter
          page={page}
          totalPages={totalPages}
          totalItems={totalCount}
          pageSize={PAGE_SIZE}
          itemLabel={inventory === "cars" ? "Cars" : "Parts"}
          prevHref={page > 1 ? pageHref(page - 1) : null}
          nextHref={page < totalPages ? pageHref(page + 1) : null}
          pageHrefs={Array.from({ length: totalPages }, (_, i) => pageHref(i + 1))}
          showPerPageNote
        />
      ) : null}

      <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-sm font-semibold text-white">Recent exports</h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-400">
          {recentExports.length === 0 ? (
            <li className="text-zinc-600">No export jobs yet.</li>
          ) : (
            recentExports.map((j) => (
              <li key={j.id} className="flex flex-wrap justify-between gap-2">
                <span>{j.entity}</span>
                <span className="text-zinc-600">{j.status}</span>
                <span className="w-full text-xs text-zinc-600">{j.summary}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
