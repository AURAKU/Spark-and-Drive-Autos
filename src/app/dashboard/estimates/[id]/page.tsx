import { redirect } from "next/navigation";
import { z } from "zod";

import { VehicleImportEstimateDocument } from "@/components/admin/duty-estimator/vehicle-import-estimate-document";
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
    <div className="space-y-4">
      <p className="text-xs text-amber-300/90">
        Estimate only: Final customs duty and payable import amounts are determined by Ghana Customs / ICUMS at clearance.
      </p>
      <VehicleImportEstimateDocument estimate={estimate} />
    </div>
  );
}
