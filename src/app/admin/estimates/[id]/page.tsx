import { redirect } from "next/navigation";
import { z } from "zod";

import { VehicleImportEstimateDocument } from "@/components/admin/duty-estimator/vehicle-import-estimate-document";
import { VehicleImportEstimatePreviewActions } from "@/components/admin/duty-estimator/vehicle-import-estimate-preview-actions";
import { requireAdmin } from "@/lib/auth-helpers";
import { getVehicleImportEstimateById } from "@/lib/vehicle-import-estimate/data";

export const dynamic = "force-dynamic";

export default async function AdminEstimatePreviewPage(props: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    redirect("/login?callbackUrl=/admin/estimates");
  }

  const { id } = await props.params;
  if (!z.string().cuid().safeParse(id).success) redirect("/admin/estimates");
  const estimate = await getVehicleImportEstimateById(id);
  if (!estimate) redirect("/admin/estimates");

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-8 sm:px-6">
      <VehicleImportEstimatePreviewActions estimateId={estimate.id} backHref="/admin/estimates" />
      <VehicleImportEstimateDocument estimate={estimate} />
    </div>
  );
}
