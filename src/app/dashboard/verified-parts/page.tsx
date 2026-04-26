import Link from "next/link";

import { requireActiveSessionOrRedirect } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export default async function DashboardVerifiedPartsPage() {
  const session = await requireActiveSessionOrRedirect("/dashboard/verified-parts");
  const rows = await prisma.verifiedPartRequest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { payment: { select: { status: true } } },
  });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Verified Part Requests</h1>
        <p className="text-sm text-muted-foreground">Paid verification and sourcing-support requests.</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No verified part requests yet.</p> : null}
        <div className="space-y-2">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/dashboard/verified-parts/${row.id}`}
              className="flex items-center justify-between rounded-lg border border-border bg-background p-3 hover:bg-muted/30"
            >
              <div>
                <p className="text-sm font-semibold">{row.requestNumber}</p>
                <p className="text-xs text-muted-foreground">{row.partName}</p>
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
