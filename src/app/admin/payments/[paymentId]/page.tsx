import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPaymentPanel } from "@/components/admin/admin-payment-panel";
import { PageHeading } from "@/components/typography/page-headings";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ paymentId: string }> };

export default async function AdminPaymentDetailPage({ params }: Props) {
  const { paymentId } = await params;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      proofs: { orderBy: { createdAt: "desc" } },
      statusHistory: { orderBy: { createdAt: "desc" }, take: 40 },
      user: { select: { email: true, name: true } },
      order: { include: { car: { select: { title: true, slug: true } } } },
    },
  });

  if (!payment) notFound();

  return (
    <div>
      <Link href="/admin/payments/intelligence" className="text-xs text-[var(--brand)] hover:underline">
        ← Payments
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <PageHeading variant="dashboard">Payment detail</PageHeading>
          <p className="mt-1 text-sm text-zinc-400">
            {formatMoney(Number(payment.amount), payment.currency)} · {payment.paymentType.replaceAll("_", " ")}
          </p>
        </div>
        {payment.orderId && payment.order?.reference ? (
          <Link
            href={`/admin/orders/${payment.orderId}`}
            className="text-sm text-[var(--brand)] hover:underline"
          >
            Order {payment.order.reference} →
          </Link>
        ) : null}
      </div>

      <div className="mt-8">
        <AdminPaymentPanel payment={payment} />
      </div>

      <div className="mt-12">
        <h2 className="text-lg font-semibold text-white">Status history</h2>
        <ul className="mt-4 space-y-3 border-l border-white/10 pl-4">
          {payment.statusHistory.map((h) => (
            <li key={h.id} className="text-sm">
              <p className="text-xs text-zinc-500">
                {h.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {h.source}
              </p>
              <p className="text-zinc-300">
                {h.fromStatus ? `${h.fromStatus} → ` : ""}
                {h.toStatus}
              </p>
              {h.note ? <p className="mt-0.5 text-zinc-500">{h.note}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
