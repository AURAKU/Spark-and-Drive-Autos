import Link from "next/link";

import { PageHeading } from "@/components/typography/page-headings";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
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

export default async function DashboardRequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSessionOrRedirect("/dashboard/requests");
  const sp = await searchParams;
  const carPageReq = readPage(sp, "carPage");
  const partPageReq = readPage(sp, "partPage");

  const [carTotal, partTotal] = await Promise.all([
    prisma.carRequest.count({ where: { userId: session.user.id } }),
    prisma.partSourcingRequest.count({ where: { userId: session.user.id } }),
  ]);

  const carTotalPages = Math.max(1, Math.ceil(Math.max(0, carTotal) / PAGE_SIZE));
  const partTotalPages = Math.max(1, Math.ceil(Math.max(0, partTotal) / PAGE_SIZE));
  const carPage = Math.min(Math.max(1, carPageReq), carTotalPages);
  const partPage = Math.min(Math.max(1, partPageReq), partTotalPages);

  const [rows, partRows] = await Promise.all([
    prisma.carRequest.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      skip: (carPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.partSourcingRequest.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      skip: (partPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const requestsHref = (next: { carPage?: number; partPage?: number }) => {
    const p = new URLSearchParams();
    const car = next.carPage ?? carPage;
    const part = next.partPage ?? partPage;
    if (car > 1) p.set("carPage", String(car));
    if (part > 1) p.set("partPage", String(part));
    const qs = p.toString();
    return qs ? `/dashboard/requests?${qs}` : "/dashboard/requests";
  };

  return (
    <div>
      <PageHeading variant="dashboard">Sourcing requests</PageHeading>
      <p className="mt-2 text-sm text-zinc-400">
        Vehicle and parts sourcing submissions. When our team sends an update, you&apos;ll also see it under{" "}
        <Link href="/dashboard/notifications" className="text-[var(--brand)] hover:underline">
          notifications
        </Link>
        .
      </p>

      <h2 className="mt-10 text-lg font-semibold text-white">Cars</h2>
      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No vehicle requests yet.{" "}
            <Link href="/request-a-car" className="text-[var(--brand)] hover:underline">
              Request a car
            </Link>
          </p>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-300"
            >
              <p className="font-medium text-white">
                {r.brand} {r.model}
                {r.yearFrom || r.yearTo ? (
                  <span className="text-zinc-500">
                    {" "}
                    ({r.yearFrom ?? "?"}–{r.yearTo ?? "?"})
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {r.status} · {r.createdAt.toLocaleString()}
              </p>
              {r.notes ? <p className="mt-2 text-zinc-400">{r.notes}</p> : null}
            </div>
          ))
        )}
      </div>
      {carTotal > 0 ? (
        <ListPaginationFooter
          page={carPage}
          totalPages={carTotalPages}
          totalItems={carTotal}
          pageSize={PAGE_SIZE}
          itemLabel="Vehicle requests"
          prevHref={carPage > 1 ? requestsHref({ carPage: carPage - 1 }) : null}
          nextHref={carPage < carTotalPages ? requestsHref({ carPage: carPage + 1 }) : null}
        />
      ) : null}

      <h2 className="mt-12 text-lg font-semibold text-white">AutoParts &amp; Accessories</h2>
      <div className="mt-4 space-y-3">
        {partRows.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No parts requests yet.{" "}
            <Link href="/request-autoparts" className="text-[var(--brand)] hover:underline">
              Request AutoParts or Accessories
            </Link>{" "}
            (signed in) or{" "}
            <Link href="/parts" className="text-[var(--brand)] hover:underline">
              browse the catalog
            </Link>
            .
          </p>
        ) : (
          partRows.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-300"
            >
              <p className="font-medium text-white">
                {r.summaryTitle?.trim() || "Parts / accessories request"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {r.status}
                {r.quantity > 1 ? ` · qty ${r.quantity}` : ""}
                {r.urgency ? ` · ${r.urgency}` : ""} · {r.createdAt.toLocaleString()}
              </p>
              <p className="mt-2 line-clamp-4 text-zinc-400">{r.description}</p>
              {r.imageUrls.length > 0 ? (
                <p className="mt-2 text-xs text-zinc-500">{r.imageUrls.length} reference image(s) on file</p>
              ) : null}
            </div>
          ))
        )}
      </div>
      {partTotal > 0 ? (
        <ListPaginationFooter
          page={partPage}
          totalPages={partTotalPages}
          totalItems={partTotal}
          pageSize={PAGE_SIZE}
          itemLabel="AutoParts requests"
          prevHref={partPage > 1 ? requestsHref({ partPage: partPage - 1 }) : null}
          nextHref={partPage < partTotalPages ? requestsHref({ partPage: partPage + 1 }) : null}
        />
      ) : null}
    </div>
  );
}
