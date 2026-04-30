import Link from "next/link";

import { PageHeading } from "@/components/typography/page-headings";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardReceiptsPage() {
  const session = await requireSessionOrRedirect("/dashboard/receipts");
  const rows = await prisma.generatedReceipt.findMany({
    where: { userId: session.user.id },
    orderBy: { issuedAt: "desc" },
    take: 100,
    include: {
      order: { select: { reference: true } },
      payment: { select: { providerReference: true } },
    },
  });
  return (
    <div className="space-y-6">
      <div>
        <PageHeading variant="dashboard">My receipts</PageHeading>
        <p className="mt-2 text-sm text-zinc-400">Download your payment receipts and track their status.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[840px] text-sm">
          <thead className="bg-black/25 text-left text-zinc-400">
            <tr>
              <th className="px-3 py-2">Receipt</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Payment</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Issued</th>
              <th className="px-3 py-2">Receipt PDF</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/10 text-zinc-200">
                <td className="px-3 py-2 font-mono">{r.receiptNumber}</td>
                <td className="px-3 py-2">{r.type.replaceAll("_", " ")}</td>
                <td className="px-3 py-2">{r.order?.reference ?? "—"}</td>
                <td className="px-3 py-2">{r.payment.providerReference ?? r.paymentReference ?? "—"}</td>
                <td className="px-3 py-2">
                  {Number(r.amount).toLocaleString("en-GH")} {r.currency}
                </td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2">{r.issuedAt.toISOString().slice(0, 19).replace("T", " ")}</td>
                <td className="px-3 py-2">
                  <span className="flex flex-wrap gap-x-3 gap-y-1">
                    <Link href={`/dashboard/receipts/${r.id}/view`} className="text-[var(--brand)] hover:underline">
                      View
                    </Link>
                    <a href={`/api/receipts/${r.id}/download`} className="text-zinc-300 hover:underline">
                      Download
                    </a>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
