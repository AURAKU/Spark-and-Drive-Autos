import Link from "next/link";

import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export default async function AdminVerifiedPartsPage() {
  await requireAdmin();
  const rows = await prisma.verifiedPartRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      payment: { select: { status: true } },
      assignedAdmin: { select: { name: true, email: true } },
    },
    take: 200,
  });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Verified Part Requests</h1>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="space-y-2">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/admin/verified-parts/${row.id}`}
              className="flex items-center justify-between rounded-lg border border-border bg-background p-3 hover:bg-muted/30"
            >
              <div>
                <p className="text-sm font-semibold">{row.requestNumber}</p>
                <p className="text-xs text-muted-foreground">{row.user.name ?? row.user.email} · {row.partName}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium">{row.status.replaceAll("_", " ")}</p>
                <p className="text-[11px] text-muted-foreground">Payment: {row.payment?.status ?? "PENDING"}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
