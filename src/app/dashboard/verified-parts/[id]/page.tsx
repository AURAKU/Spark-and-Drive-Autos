import Link from "next/link";
import { notFound } from "next/navigation";

import { requireActiveSessionOrRedirect } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export default async function DashboardVerifiedPartDetailPage(props: { params: Promise<{ id: string }> }) {
  const session = await requireActiveSessionOrRedirect("/dashboard/verified-parts");
  const { id } = await props.params;
  const row = await prisma.verifiedPartRequest.findFirst({
    where: { id, userId: session.user.id },
    include: { payment: true, receipt: true },
  });
  if (!row) notFound();
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">{row.requestNumber}</p>
        <h1 className="text-xl font-semibold">{row.partName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {row.vehicleYear ?? "-"} {row.vehicleMake ?? ""} {row.vehicleModel ?? ""} {row.vehicleEngine ?? ""}
        </p>
        <p className="mt-2 text-sm">
          Status: <span className="font-semibold">{row.status.replaceAll("_", " ")}</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {row.status === "AWAITING_PAYMENT"
            ? "Payment required to begin verification."
            : row.status === "PAID"
              ? "Payment received. Your request is queued."
              : row.status === "IN_REVIEW"
                ? "Our parts team is reviewing fitment."
                : row.status === "VERIFIED"
                  ? "Verified match available."
                  : row.status === "NEEDS_MORE_INFO"
                    ? "We need additional vehicle or part details."
                    : row.status === "FAILED"
                      ? "We could not verify this part from available information."
                      : "Request in progress."}
        </p>
      </div>
      {row.status === "AWAITING_PAYMENT" ? (
        <form action={`/api/verified-parts/${row.id}/pay`} method="post">
          <button type="submit" className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-black">
            Continue payment
          </button>
        </form>
      ) : null}
      {row.receipt?.id ? (
        <Link
          href={`/api/receipts/${row.receipt.id}/download`}
          className="inline-flex rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/40"
        >
          Download receipt
        </Link>
      ) : null}
      {row.resultJson ? (
        <pre className="overflow-auto rounded-lg border border-border bg-muted/20 p-3 text-xs">
          {JSON.stringify(row.resultJson, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
