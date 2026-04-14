import Link from "next/link";

import { PageHeading } from "@/components/typography/page-headings";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { formatMoney } from "@/lib/format";
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

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSessionOrRedirect("/dashboard/orders");
  const userId = session.user.id;
  const sp = await searchParams;
  const pageReq = readPage(sp, "page");
  const total = await prisma.order.count({ where: { userId } });
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / PAGE_SIZE));
  const page = Math.min(Math.max(1, pageReq), totalPages);

  const orders = await prisma.order.findMany({
    where: { userId },
    include: { car: true, partItems: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const pageHref = (nextPage: number) => (nextPage > 1 ? `/dashboard/orders?page=${nextPage}` : "/dashboard/orders");

  return (
    <div>
      <PageHeading variant="dashboard">Orders</PageHeading>
      <p className="mt-2 text-sm text-zinc-400">Purchase and reservation records. Open an order for payment detail.</p>
      <div className="mt-8 space-y-3">
        {orders.length === 0 ? (
          <p className="text-sm text-zinc-500">No orders yet.</p>
        ) : (
          orders.map((o) => (
            <Link
              key={o.id}
              href={`/dashboard/orders/${o.id}`}
              className="block rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:bg-white/[0.06]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-zinc-500">{o.reference}</p>
                  <p className="text-sm text-white">
                    {o.kind === "PARTS"
                      ? `${o.partItems.length} part item${o.partItems.length === 1 ? "" : "s"}`
                      : (o.car?.title ?? "Vehicle")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-[var(--brand)]">{formatMoney(Number(o.amount), o.currency)}</p>
                  <p className="text-xs text-zinc-500">{o.orderStatus.replaceAll("_", " ")}</p>
                  {o.payments[0] ? (
                    <div className="mt-2 flex justify-end">
                      <PaymentStatusBadge status={o.payments[0].status} />
                    </div>
                  ) : null}
                </div>
              </div>
              <span className="mt-3 inline-block text-sm text-[var(--brand)]">View order →</span>
            </Link>
          ))
        )}
      </div>
      {total > 0 ? (
        <ListPaginationFooter
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          itemLabel="Orders"
          prevHref={page > 1 ? pageHref(page - 1) : null}
          nextHref={page < totalPages ? pageHref(page + 1) : null}
        />
      ) : null}
    </div>
  );
}
