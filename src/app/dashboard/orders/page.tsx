import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { DashboardOrdersFilter } from "@/components/dashboard/dashboard-orders-filter";
import { PageHeading } from "@/components/typography/page-headings";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { orderPartsLineageLabel } from "@/lib/admin-orders-parts-filter";
import { formatMoney } from "@/lib/format";
import {
  ordersListHref,
  parseDashboardOrderFilter,
  whereForDashboardOrderFilter,
} from "@/lib/dashboard-orders-filter";
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

const PAGE_SIZE = 10;

const CAR_STOCK: Record<string, string> = {
  IN_GHANA: "Ghana stock",
  IN_CHINA: "China stock",
  IN_TRANSIT: "In transit",
};

async function loadDashboardOrdersData(where: Prisma.OrderWhereInput, userId: string, pageReq: number) {
  const [total, totalUnfiltered] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.count({ where: { userId } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / PAGE_SIZE));
  const page = Math.min(Math.max(1, pageReq), totalPages);
  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      reference: true,
      kind: true,
      orderStatus: true,
      amount: true,
      currency: true,
      car: { select: { title: true, sourceType: true } },
      partItems: { select: { origin: true, part: { select: { stockStatus: true } } } },
      payments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  return { total, totalUnfiltered, totalPages, page, orders };
}

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSessionOrRedirect("/dashboard/orders");
  const userId = session.user.id;
  const sp = await searchParams;
  const pageReq = readPage(sp, "page");
  const filter = parseDashboardOrderFilter(sp.filter);
  const where = whereForDashboardOrderFilter(userId, filter);

  const { total, totalUnfiltered, totalPages, page, orders } = await loadDashboardOrdersData(where, userId, pageReq);
  const pageHref = (nextPage: number) => ordersListHref(nextPage, filter);

  return (
    <div>
      <PageHeading variant="dashboard">All orders</PageHeading>
      <p className="mt-2 text-sm text-zinc-400">
        Purchase and reservation records. Open an order for payment detail. Filter by parts (Ghana vs China pre-order) or
        cars (inventory region).
      </p>
      <DashboardOrdersFilter active={filter} />
      <div className="mt-8 space-y-3">
        {orders.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {totalUnfiltered === 0
              ? "No orders yet."
              : "No orders match this filter. Try another filter or view all orders."}
          </p>
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
                  {o.kind === "CAR" && o.car ? (
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                      Car · {CAR_STOCK[o.car.sourceType] ?? o.car.sourceType.replaceAll("_", " ")}
                    </p>
                  ) : null}
                  {o.kind === "PARTS" && o.partItems.length > 0 ? (
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                      Parts ·{" "}
                      {orderPartsLineageLabel({
                        kind: o.kind,
                        partItems: o.partItems.map((i) => ({
                          origin: i.origin,
                          part: i.part ? { stockStatus: i.part.stockStatus } : null,
                        })),
                      })}
                    </p>
                  ) : null}
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
