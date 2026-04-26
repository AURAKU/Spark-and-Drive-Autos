import Link from "next/link";
import { Prisma } from "@prisma/client";

import { DutyEstimatesIntro } from "@/components/duty/duty-estimate-customer-copy";
import { PageHeading } from "@/components/typography/page-headings";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { formatEstimateMoney } from "@/lib/vehicle-import-estimate/data";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type EstimateRow = {
  id: string;
  estimateNumber: string;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "EXPIRED" | "SUPERSEDED";
  vehicleName: string;
  estimatedDutyRangeMin: number | null;
  estimatedDutyRangeMax: number | null;
  estimatedLandedCost: number | null;
  updatedAt: Date;
  orderId: string | null;
  orderReference: string | null;
};

function statusChip(status: EstimateRow["status"]) {
  const label = status.replaceAll("_", " ");
  const cls =
    status === "ACCEPTED"
      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
      : status === "SENT"
        ? "border-cyan-500/35 bg-cyan-500/10 text-cyan-200"
        : status === "EXPIRED"
          ? "border-zinc-500/35 bg-zinc-500/10 text-zinc-300"
          : status === "SUPERSEDED"
            ? "border-violet-500/35 bg-violet-500/10 text-violet-200"
            : "border-amber-500/35 bg-amber-500/10 text-amber-200";
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", cls)}>
      {label}
    </span>
  );
}

export default async function DashboardEstimatesPage() {
  const session = await requireSessionOrRedirect("/dashboard/estimates");
  const rows = await prisma.$queryRaw<EstimateRow[]>(Prisma.sql`
    SELECT
      e."id",
      e."estimateNumber",
      e."status"::text AS "status",
      e."vehicleName",
      e."estimatedDutyRangeMin",
      e."estimatedDutyRangeMax",
      e."estimatedLandedCost",
      e."updatedAt",
      e."orderId",
      o."reference" AS "orderReference"
    FROM "VehicleImportEstimate" e
    LEFT JOIN "Order" o ON o."id" = e."orderId"
    WHERE e."customerId" = ${session.user.id} OR o."userId" = ${session.user.id}
    ORDER BY e."updatedAt" DESC
  `);

  return (
    <div className="space-y-6">
      <div>
        <PageHeading variant="dashboard">Duty Estimates</PageHeading>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Ghana import duty planning for your vehicles — prepared by Spark and Drive. These are not final customs
          assessments; they help you budget before clearance.
        </p>
      </div>

      <DutyEstimatesIntro />

      <div className="mt-2 space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
            <p className="text-sm text-zinc-400">No duty estimates are linked to your account yet.</p>
            <p className="mt-2 text-xs text-zinc-500">
              When our team prepares an estimate for your import, it will appear here. Clearance payments, when requested,
              show on the{" "}
              <Link href="/dashboard/orders" className="text-[var(--brand)] hover:underline">
                relevant vehicle order
              </Link>
              .
            </p>
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-[var(--brand)]/25"
            >
              <Link href={`/dashboard/estimates/${row.id}`} className="block outline-none">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm font-semibold text-white">{row.estimateNumber}</p>
                      {statusChip(row.status)}
                    </div>
                    <p className="text-sm font-medium text-zinc-200">{row.vehicleName}</p>
                    <p className="text-xs text-[var(--brand)]">View full duty breakdown →</p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-zinc-400">
                    <p>
                      Duty range: {formatEstimateMoney(row.estimatedDutyRangeMin)} –{" "}
                      {formatEstimateMoney(row.estimatedDutyRangeMax)}
                    </p>
                    <p className="mt-1">Indicative landed: {formatEstimateMoney(row.estimatedLandedCost)}</p>
                    <p className="mt-2 text-[10px] text-zinc-500">Updated {row.updatedAt.toLocaleString()}</p>
                  </div>
                </div>
              </Link>
              {row.orderId && row.orderReference ? (
                <div className="mt-3 border-t border-white/5 pt-3">
                  <Link
                    href={`/dashboard/orders/${row.orderId}`}
                    className="text-xs text-zinc-400 transition hover:text-[var(--brand)]"
                  >
                    Vehicle order <span className="font-mono text-zinc-300">{row.orderReference}</span>
                    <span className="text-zinc-500"> — shipping, clearance &amp; duty payment requests</span>
                  </Link>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
