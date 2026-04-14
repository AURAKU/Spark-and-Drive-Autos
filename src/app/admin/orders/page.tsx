import Link from "next/link";
import { Suspense } from "react";

import { AdminOperationsDateFilter } from "@/components/admin/admin-operations-date-filter";
import { PageHeading } from "@/components/typography/page-headings";
import { AdminOrdersExportButtons } from "@/components/admin/admin-orders-export-buttons";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import type { OrderKind } from "@prisma/client";

import { appendOpsDateParams, parseOpsDateFromSearchParams } from "@/lib/admin-operations-date-filter";
import { orderItemTitleSummary } from "@/lib/order-item-display";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminOrdersPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const kindRaw = typeof sp.kind === "string" ? sp.kind : "";
  const kindFilter: OrderKind | null =
    kindRaw === "CAR" || kindRaw === "PARTS" ? (kindRaw as OrderKind) : null;

  const ops = parseOpsDateFromSearchParams(sp);

  const rows = await prisma.order.findMany({
    where: {
      ...(kindFilter ? { kind: kindFilter } : {}),
      ...(ops.range ? { createdAt: { gte: ops.range.gte, lt: ops.range.lt } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true, car: true, partItems: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  const buildHref = (kind: "" | "CAR" | "PARTS") => {
    const p = new URLSearchParams();
    if (kind) p.set("kind", kind);
    appendOpsDateParams(p, sp);
    const qs = p.toString();
    return qs ? `/admin/orders?${qs}` : "/admin/orders";
  };

  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.02]" />}>
        <AdminOperationsDateFilter />
      </Suspense>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <PageHeading variant="dashboard">All Orders</PageHeading>
          <p className="mt-2 text-sm text-zinc-400">Latest purchase and reservation records.</p>
        </div>
        <Suspense fallback={<span className="text-xs text-zinc-500">Export…</span>}>
          <AdminOrdersExportButtons />
        </Suspense>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={buildHref("")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            !kindFilter ? "bg-[var(--brand)] text-black" : "border border-white/15 text-zinc-300"
          }`}
        >
          All
        </Link>
        <Link
          href={buildHref("CAR")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            kindFilter === "CAR" ? "bg-[var(--brand)] text-black" : "border border-white/15 text-zinc-300"
          }`}
        >
          Cars Inventory
        </Link>
        <Link
          href={buildHref("PARTS")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            kindFilter === "PARTS" ? "bg-[var(--brand)] text-black" : "border border-white/15 text-zinc-300"
          }`}
        >
          Parts & Accessories
        </Link>
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs tracking-wide text-zinc-500 uppercase">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Item title</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                  No orders yet.
                </td>
              </tr>
            ) : (
              rows.map((o) => (
                <tr key={o.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono text-xs text-zinc-300">{o.reference}</td>
                  <td className="max-w-xs px-4 py-3 text-zinc-300">
                    {o.kind === "CAR" && o.car ? (
                      <Link className="text-[var(--brand)] hover:underline" href={`/cars/${o.car.slug}`}>
                        {orderItemTitleSummary(o)}
                      </Link>
                    ) : (
                      <span className="line-clamp-2">{orderItemTitleSummary(o)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{o.orderStatus}</td>
                  <td className="px-4 py-3">
                    {o.payments[0] ? (
                      <PaymentStatusBadge status={o.payments[0].status} />
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{o.user?.email ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--brand)]">{formatMoney(Number(o.amount), o.currency)}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{o.createdAt.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <Link className="text-[var(--brand)] hover:underline" href={`/admin/orders/${o.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
