import { redirect } from "next/navigation";

import { VehicleImportEstimateDocument } from "@/components/admin/duty-estimator/vehicle-import-estimate-document";
import { VehicleImportEstimatePreviewActions } from "@/components/admin/duty-estimator/vehicle-import-estimate-preview-actions";
import { requireAdmin } from "@/lib/auth-helpers";
import { getVehicleImportEstimateById } from "@/lib/vehicle-import-estimate/data";

export const dynamic = "force-dynamic";

export default async function VehicleImportEstimatePreviewPage(props: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    redirect("/login?callbackUrl=/admin/duty-estimator");
  }

  const { id } = await props.params;
  const estimate = await getVehicleImportEstimateById(id);
  if (!estimate) redirect("/admin/duty-estimator");

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-8 sm:px-6">
      <VehicleImportEstimatePreviewActions estimateId={estimate.id} backHref="/admin/duty-estimator" />
      <VehicleImportEstimateDocument estimate={estimate} />
    </div>
  );
}
