import type { OrderStatus } from "@prisma/client";
import Link from "next/link";
import { Suspense } from "react";

import { AdminDutyHubClient } from "@/components/admin/admin-duty-hub-client";
import { PageHeading } from "@/components/typography/page-headings";
import { AdminOperationsDateFilter } from "@/components/admin/admin-operations-date-filter";
import { DutyEstimateDisclosure } from "@/components/duty/duty-estimate-disclosure";
import { DutyOfficialLinks } from "@/components/duty/duty-official-links";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { appendOpsDateParams, parseOpsDateFromSearchParams } from "@/lib/admin-operations-date-filter";
import type { AdminDutyOrderRow } from "@/lib/duty/admin-duty-types";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DUTY_ORDER_PAGE_SIZE = 25;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readDutyPage(sp: Record<string, string | string[] | undefined>): number {
  const v = sp.dutyPage;
  const s = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  if (!s) return 1;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 99_999);
}

function dutyListHref(sp: Record<string, string | string[] | undefined>, dutyPage: number): string {
  const p = new URLSearchParams();
  if (dutyPage > 1) p.set("dutyPage", String(dutyPage));
  appendOpsDateParams(p, sp);
  const qs = p.toString();
  return qs ? `/admin/duty?${qs}` : "/admin/duty";
}

export default async function AdminDutyPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const ops = parseOpsDateFromSearchParams(sp);
  const requestedPage = readDutyPage(sp);

  const excludedStatuses: OrderStatus[] = ["DRAFT", "PENDING_PAYMENT", "CANCELLED"];
  const baseWhere = {
    kind: "CAR" as const,
    orderStatus: { notIn: excludedStatuses },
    ...(ops.range ? { updatedAt: { gte: ops.range.gte, lt: ops.range.lt } } : {}),
  };

  const totalOrders = await prisma.order.count({ where: baseWhere });
  const totalPages = Math.max(1, Math.ceil(totalOrders / DUTY_ORDER_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const orders = await prisma.order.findMany({
    where: baseWhere,
    skip: (page - 1) * DUTY_ORDER_PAGE_SIZE,
    take: DUTY_ORDER_PAGE_SIZE,
    orderBy: { updatedAt: "desc" },
    include: {
      user: { select: { email: true } },
      car: { select: { title: true, slug: true, year: true, basePriceRmb: true } },
      shipments: { where: { kind: "CAR_SEA" }, take: 1, orderBy: { createdAt: "desc" } },
      dutyRecords: { orderBy: { updatedAt: "desc" }, take: 1 },
      payments: {
        where: { paymentType: "DUTY" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, status: true, amount: true, currency: true },
      },
    },
  });

  const rows: AdminDutyOrderRow[] = orders.map((o) => {
    const d = o.dutyRecords[0];
    const ship = o.shipments[0];
    return {
      id: o.id,
      reference: o.reference,
      orderStatus: o.orderStatus,
      userEmail: o.user?.email ?? null,
      carTitle: o.car?.title ?? null,
      carSlug: o.car?.slug ?? null,
      carYear: o.car?.year ?? null,
      basePriceRmb: o.car?.basePriceRmb != null ? Number(o.car.basePriceRmb) : null,
      currency: o.currency,
      orderAmountGhs: Number(o.amount),
      seaShipment: ship ? { id: ship.id, currentStage: ship.currentStage } : null,
      duty: d
        ? {
            id: d.id,
            workflowStage: d.workflowStage,
            estimateTotalGhs: d.estimateTotalGhs != null ? Number(d.estimateTotalGhs) : null,
            assessedDutyGhs: d.assessedDutyGhs != null ? Number(d.assessedDutyGhs) : null,
            customerVisibleNote: d.customerVisibleNote,
            internalNote: d.internalNote,
            dutyAmount: d.dutyAmount != null ? Number(d.dutyAmount) : null,
            formulaVersion: d.formulaVersion,
          }
        : null,
      dutyPayments: o.payments.map((p) => ({
        id: p.id,
        status: p.status,
        amount: Number(p.amount),
        currency: p.currency,
      })),
    };
  });

  return (
    <div className="space-y-8">
      <Suspense fallback={<div className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.02]" />}>
        <AdminOperationsDateFilter />
      </Suspense>

      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0c1420] to-black/60 p-6 shadow-[0_0_60px_-30px_rgba(49,182,199,0.2)]">
        <PageHeading variant="dashboard">Duty estimation &amp; operations</PageHeading>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
          Manage import duty for vehicle orders arriving in Ghana. Estimates are planning aids only — final charges are
          determined by Ghana Customs / ICUMS at clearance. Link each case to sea freight, publish customer-visible
          updates, record assessed duty, and raise duty payment requests when ready.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <DutyEstimateDisclosure variant="long" />
          </div>
          <DutyOfficialLinks compact />
        </div>
        <p className="mt-4 text-xs text-zinc-600">
          Need the full vehicle record?{" "}
          <Link href="/admin/orders" className="text-[var(--brand)] hover:underline">
            All orders
          </Link>
        </p>
      </div>

      <AdminDutyHubClient rows={rows} />
      <ListPaginationFooter
        className="px-0"
        pageSize={DUTY_ORDER_PAGE_SIZE}
        page={page}
        totalPages={totalPages}
        totalItems={totalOrders}
        itemLabel="Vehicle orders (duty scope)"
        prevHref={page > 1 ? dutyListHref(sp, page - 1) : null}
        nextHref={page < totalPages ? dutyListHref(sp, page + 1) : null}
      />
    </div>
  );
}
