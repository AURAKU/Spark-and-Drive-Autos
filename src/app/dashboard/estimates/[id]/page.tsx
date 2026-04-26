import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";

import { VehicleImportEstimateDocument } from "@/components/admin/duty-estimator/vehicle-import-estimate-document";
import { PageHeading } from "@/components/typography/page-headings";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { canUserAccessEstimate, getVehicleImportEstimateById } from "@/lib/vehicle-import-estimate/data";

export const dynamic = "force-dynamic";

export default async function DashboardEstimateDetailPage(props: { params: Promise<{ id: string }> }) {
  const session = await requireSessionOrRedirect("/dashboard/estimates");
  const { id } = await props.params;
  if (!z.string().cuid().safeParse(id).success) redirect("/dashboard/estimates");

  const estimate = await getVehicleImportEstimateById(id);
  if (!estimate) redirect("/dashboard/estimates");

  const canAccess = await canUserAccessEstimate(id, session.user.id);
  if (!canAccess) redirect("/dashboard/estimates");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/estimates" className="text-sm font-medium text-[var(--brand)] hover:underline">
          ← Duty Estimates
        </Link>
        <PageHeading variant="dashboard" className="mt-3">
          {estimate.estimateNumber}
        </PageHeading>
        <p className="mt-2 text-sm text-zinc-400">{estimate.vehicleName}</p>
        <p className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-xs leading-relaxed text-amber-100/90">
          Planning estimate only — final customs duty and payable import amounts are determined by Ghana Customs / ICUMS at
          clearance. This document does not replace your order&apos;s clearance payment requests when operations publishes
          them.
        </p>
      </div>
      <VehicleImportEstimateDocument estimate={estimate} />
    </div>
  );
}
