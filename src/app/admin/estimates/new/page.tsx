import Link from "next/link";
import { redirect } from "next/navigation";

import { VehicleImportEstimateCreateForm } from "@/components/admin/duty-estimator/vehicle-import-estimate-create-form";
import { PageHeading } from "@/components/typography/page-headings";
import { requireAdmin } from "@/lib/auth-helpers";
import { fetchVehicleImportEstimateFormLinkOptions } from "@/lib/vehicle-import-estimate/admin-form-options";

export const dynamic = "force-dynamic";

export default async function AdminEstimateNewPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  try {
    await requireAdmin();
  } catch {
    redirect("/login?callbackUrl=/admin/estimates/new");
  }

  const sp = await props.searchParams;
  const defaults = {
    clientName: typeof sp.clientName === "string" ? sp.clientName : "",
    clientContact: typeof sp.clientContact === "string" ? sp.clientContact : "",
    vehicleName: typeof sp.vehicleName === "string" ? sp.vehicleName : "",
    customerId: typeof sp.customerId === "string" ? sp.customerId : "",
    orderId: typeof sp.orderId === "string" ? sp.orderId : "",
    inquiryId: typeof sp.inquiryId === "string" ? sp.inquiryId : "",
    carId: typeof sp.carId === "string" ? sp.carId : "",
  };

  const { users, orders, inquiries, cars } = await fetchVehicleImportEstimateFormLinkOptions({
    userId: defaults.customerId || null,
    orderId: defaults.orderId || null,
    inquiryId: defaults.inquiryId || null,
    carId: defaults.carId || null,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <PageHeading variant="dashboard">Create Duty Estimate</PageHeading>
          <p className="mt-2 text-sm text-zinc-400">
            Per-vehicle Ghana import duty planning for clients — include ranges, landed cost, and the standard customs
            disclaimer.
          </p>
        </div>
        <Link href="/admin/estimates" className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/60">
          Back to Duty Estimates
        </Link>
      </div>
      <VehicleImportEstimateCreateForm users={users} orders={orders} inquiries={inquiries} cars={cars} defaults={defaults} />
    </div>
  );
}
