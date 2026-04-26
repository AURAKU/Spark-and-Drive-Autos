import Link from "next/link";

import { voidReceiptAction } from "@/actions/receipt-template";
import { PageHeading } from "@/components/typography/page-headings";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const dynamic = "force-dynamic";

export default async function AdminReceiptsPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const pageSize = 30;
  const where = q
    ? {
        OR: [
          { receiptNumber: { contains: q, mode: "insensitive" as const } },
          { paymentReference: { contains: q, mode: "insensitive" as const } },
          { payment: { providerReference: { contains: q, mode: "insensitive" as const } } },
          { order: { reference: { contains: q, mode: "insensitive" as const } } },
          { user: { email: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.generatedReceipt.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { email: true, name: true } },
        order: { select: { reference: true } },
        payment: { select: { providerReference: true } },
      },
    }),
    prisma.generatedReceipt.count({ where }),
  ]);
  const hasNext = page * pageSize < total;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <PageHeading variant="dashboard">Receipts archive</PageHeading>
          <p className="mt-2 text-sm text-zinc-400">Search, download, and void generated receipts.</p>
        </div>
        <Link href="/admin/settings/receipt-template" className="text-sm text-[var(--brand)] hover:underline">
          Manage templates →
        </Link>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Receipt no, payment ref, customer email, order ref"
          className="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
        />
        <button type="submit" className="h-10 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black">
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-black/25 text-left text-zinc-400">
            <tr>
              <th className="px-3 py-2">Receipt</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Payment</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Issued</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/10 text-zinc-200">
                <td className="px-3 py-2 font-mono">{r.receiptNumber}</td>
                <td className="px-3 py-2">{r.type.replaceAll("_", " ")}</td>
                <td className="px-3 py-2">{r.user.name || r.user.email}</td>
                <td className="px-3 py-2">{r.order?.reference ?? "—"}</td>
                <td className="px-3 py-2">{r.payment.providerReference ?? r.paymentReference ?? "—"}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2">{r.issuedAt.toISOString().slice(0, 19).replace("T", " ")}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <a href={`/api/receipts/${r.id}/download`} className="text-[var(--brand)] hover:underline">
                      Download
                    </a>
                    {r.status !== "VOIDED" ? (
                      <form action={voidReceiptAction} className="flex items-center gap-1">
                        <input type="hidden" name="receiptId" value={r.id} />
                        <input
                          name="reason"
                          required
                          minLength={4}
                          placeholder="Void reason"
                          className="h-8 rounded border border-white/10 bg-black/30 px-2 text-xs text-white"
                        />
                        <button type="submit" className="text-xs text-red-400 hover:text-red-300">
                          Void
                        </button>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-4 text-sm">
        {page > 1 ? <Link href={`/admin/receipts?q=${encodeURIComponent(q)}&page=${page - 1}`} className="text-[var(--brand)] hover:underline">Previous</Link> : <span className="text-zinc-500">Previous</span>}
        {hasNext ? <Link href={`/admin/receipts?q=${encodeURIComponent(q)}&page=${page + 1}`} className="text-[var(--brand)] hover:underline">Next</Link> : <span className="text-zinc-500">Next</span>}
      </div>
    </div>
  );
}
