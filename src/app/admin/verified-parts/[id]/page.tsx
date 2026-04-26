import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export default async function AdminVerifiedPartDetailPage(props: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  const { id } = await props.params;
  const row = await prisma.verifiedPartRequest.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      payment: true,
      receipt: true,
      partsFinderSearch: { select: { id: true, sessionId: true } },
      userVehicle: true,
    },
  });
  if (!row) notFound();
  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      action: "verified_part_request.admin_opened",
      entityType: "VerifiedPartRequest",
      entityId: row.id,
    },
  });
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">{row.requestNumber}</p>
        <h1 className="text-xl font-semibold">{row.partName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{row.user.name ?? row.user.email}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {row.vehicleYear ?? "-"} {row.vehicleMake ?? ""} {row.vehicleModel ?? ""} {row.vehicleEngine ?? ""}
        </p>
      </div>
      <form action={`/api/admin/verified-parts/${row.id}`} method="post" className="rounded-xl border border-border bg-card p-4">
        <input type="hidden" name="_method" value="PATCH" />
        <p className="text-sm font-medium">Admin update</p>
        <p className="text-xs text-muted-foreground">Use API endpoint for advanced updates; this page is operational read-first MVP.</p>
      </form>
      {row.selectedMatchSnapshot ? (
        <pre className="overflow-auto rounded-lg border border-border bg-muted/20 p-3 text-xs">
          {JSON.stringify(row.selectedMatchSnapshot, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
