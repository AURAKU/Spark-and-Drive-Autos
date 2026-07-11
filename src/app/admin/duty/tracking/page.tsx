import type { OrderStatus } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AdminDutyHubClient } from "@/components/admin/admin-duty-hub-client";
import { AdminOperationsDateFilter } from "@/components/admin/admin-operations-date-filter";
import { PageHeading } from "@/components/typography/page-headings";
import { DutyEstimateDisclosure } from "@/components/duty/duty-estimate-disclosure";
import { DutyIntelligenceSourceNote } from "@/components/duty/duty-intelligence-source-note";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { appendOpsDateParams, parseOpsDateFromSearchParams } from "@/lib/admin-operations-date-filter";
import type { AdminDutyOrderRow } from "@/lib/duty/admin-duty-types";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

const DUTY_ORDER_PAGE_SIZE = 15;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readDutyPage(sp: Record<string, string | string[] | undefined>): number {
  const v = sp.dutyPage ?? sp.page;
  const s = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  if (!s) return 1;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 99_999);
}

function dutyListHref(sp: Record<string, string | string[] | undefined>, dutyPage: number): string {
  const p = new URLSearchParams();
  if (dutyPage > 1) p.set("page", String(dutyPage));
  appendOpsDateParams(p, sp);
  const qs = p.toString();
  return qs ? `/admin/duty/tracking?${qs}` : "/admin/duty/tracking";
}

export default async function DutyTrackingPage(props: { searchParams: SearchParams }) {
  await requireAdmin();
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
      car: { select: { title: true, slug: true, year: true, basePriceRmb: true, engineType: true } },
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
      carEngineType: o.car?.engineType ?? null,
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

      <div className="rounded-2xl border border-border bg-card p-6 dark:border-white/10">
        <PageHeading variant="dashboard">Order duty tracking</PageHeading>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Manage import duty for vehicle orders. Record assessed duty and payment requests per order.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <DutyEstimateDisclosure variant="long" />
          <DutyIntelligenceSourceNote compact />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          <Link href="/admin/duty/calculations" className="text-primary hover:underline">Saved calculations</Link>
          {" · "}
          <Link href="/admin/orders" className="text-primary hover:underline">All orders</Link>
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
