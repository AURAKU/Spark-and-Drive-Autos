import Link from "next/link";
import { Prisma } from "@prisma/client";

import { PageHeading } from "@/components/typography/page-headings";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { formatEstimateMoney } from "@/lib/vehicle-import-estimate/data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardEstimatesPage() {
  const session = await requireSessionOrRedirect("/dashboard/estimates");
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      estimateNumber: string;
      status: "DRAFT" | "SENT" | "ACCEPTED" | "EXPIRED" | "SUPERSEDED";
      vehicleName: string;
      estimatedDutyRangeMin: number | null;
      estimatedDutyRangeMax: number | null;
      estimatedLandedCost: number | null;
      importantNotice: string | null;
      updatedAt: Date;
    }>
  >(Prisma.sql`
    SELECT
      e."id", e."estimateNumber", e."status"::text AS "status", e."vehicleName",
      e."estimatedDutyRangeMin", e."estimatedDutyRangeMax", e."estimatedLandedCost", e."importantNotice", e."updatedAt"
    FROM "VehicleImportEstimate" e
    LEFT JOIN "Order" o ON o."id" = e."orderId"
    WHERE e."customerId" = ${session.user.id} OR o."userId" = ${session.user.id}
    ORDER BY e."updatedAt" DESC
  `);

  return (
    <div>
      <PageHeading variant="dashboard">Import Estimates</PageHeading>
      <p className="mt-2 text-sm text-zinc-400">
        These are planning estimates only, not final Ghana Customs / ICUMS assessed demands.
      </p>
      <div className="mt-6 space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500">No estimates available yet.</p>
        ) : (
          rows.map((row) => (
            <Link
              key={row.id}
              href={`/dashboard/estimates/${row.id}`}
              className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.05]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{row.estimateNumber}</p>
                  <p className="text-xs text-zinc-500">{row.status.replaceAll("_", " ")}</p>
                  <p className="mt-1 text-sm text-zinc-300">{row.vehicleName}</p>
                </div>
                <div className="text-right text-xs text-zinc-400">
                  <p>
                    Duty range: {formatEstimateMoney(row.estimatedDutyRangeMin)} - {formatEstimateMoney(row.estimatedDutyRangeMax)}
                  </p>
                  <p>Landed cost: {formatEstimateMoney(row.estimatedLandedCost)}</p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
