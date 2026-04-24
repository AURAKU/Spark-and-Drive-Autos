import Link from "next/link";
import { redirect } from "next/navigation";

import { VehicleImportEstimateCreateForm } from "@/components/admin/duty-estimator/vehicle-import-estimate-create-form";
import { PageHeading } from "@/components/typography/page-headings";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

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

  const [users, orders, inquiries, cars] = await Promise.all([
    prisma.user.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, name: true, email: true },
    }),
    prisma.order.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        reference: true,
        user: { select: { name: true, email: true } },
        car: { select: { title: true } },
      },
    }),
    prisma.inquiry.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        message: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.car.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, title: true, year: true, engineType: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <PageHeading variant="dashboard">Create Vehicle Import Estimate</PageHeading>
          <p className="mt-2 text-sm text-zinc-400">
            Build a professional estimate with clear duty uncertainty and an explicit customs disclaimer.
          </p>
        </div>
        <Link href="/admin/estimates" className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/60">
          Back to estimates
        </Link>
      </div>
      <VehicleImportEstimateCreateForm users={users} orders={orders} inquiries={inquiries} cars={cars} defaults={defaults} />
    </div>
  );
}
