import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeading } from "@/components/typography/page-headings";
import { AlipaySupportHandoffDialog } from "@/components/payments/alipay-support-handoff-dialog";
import { PaymentProofUpload } from "@/components/payments/payment-proof-upload";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { formatMoney } from "@/lib/format";
import { getSettlementInstructions, settlementMethodLabel } from "@/lib/payment-settlement";
import { isPaymentProofPdfUrl } from "@/lib/payment-proof-url";
import { prisma } from "@/lib/prisma";
import { PaymentProvider } from "@prisma/client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ paymentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { paymentId } = await params;
  return { title: `Payment ${paymentId.slice(0, 8)}…` };
}

export default async function DashboardPaymentDetailPage({ params, searchParams }: Props) {
  const { paymentId } = await params;
  const sp = await searchParams;
  const alipayParam = sp.alipay;
  const alipayFromCheckout = alipayParam === "1" || alipayParam === "true";
  const session = await requireSessionOrRedirect(`/dashboard/payments/${paymentId}`);
  const userId = session.user.id;

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId },
    include: {
      order: { include: { car: { select: { title: true, slug: true } } } },
      proofs: { orderBy: { createdAt: "desc" } },
      statusHistory: { orderBy: { createdAt: "desc" }, take: 40 },
    },
  });

  if (!payment) notFound();

  const showAlipayHandoff = payment.settlementMethod === "ALIPAY_RMB" && alipayFromCheckout;

  return (
    <div>
      {showAlipayHandoff ? <AlipaySupportHandoffDialog paymentId={paymentId} showHandoff /> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/payments" className="text-xs text-[var(--brand)] hover:underline">
            ← Payments
          </Link>
          <PageHeading variant="dashboard" className="mt-2">
            Payment
          </PageHeading>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{payment.providerReference ?? payment.id}</p>
        </div>
        <PaymentStatusBadge status={payment.status} />
      </div>

      {payment.provider === PaymentProvider.MANUAL &&
      (payment.status === "AWAITING_PROOF" || payment.status === "PROCESSING") ? (
        <div className="mt-6 rounded-2xl border border-amber-500/35 bg-amber-500/[0.12] p-5 text-sm leading-relaxed text-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-50/95">
          <p className="text-base font-semibold text-amber-950 dark:text-amber-100">Complete payment to secure your vehicle</p>
          <p className="mt-2 text-amber-950/90 dark:text-amber-50/90">
            {payment.order?.car ? (
              <>
                For <span className="font-medium text-amber-950 dark:text-white">{payment.order.car.title}</span>, send
                funds using the instructions below. Then upload a clear payment screenshot or official receipt here.
                Our team will review and approve it—only after approval is your purchase confirmed and your inventory
                position secured per your payment type (reservation or full payment).
              </>
            ) : (
              <>
                Send funds using the instructions below, then upload a clear payment screenshot or official receipt.
                Our team will verify it before your purchase is fully confirmed.
              </>
            )}
          </p>
        </div>
      ) : null}

      {payment.provider === PaymentProvider.MANUAL && payment.status === "SUCCESS" && payment.orderId ? (
        <div className="mt-6 rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.1] p-5 text-sm leading-relaxed text-emerald-50 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-50/95">
          <p className="text-base font-semibold text-emerald-950 dark:text-emerald-100">Payment approved</p>
          <p className="mt-2 text-emerald-950/90 dark:text-emerald-50/90">
            Your purchase receipt has been generated. Open your order to review line items, totals, and download your
            PDF receipt for your records.
          </p>
          <Link
            href={`/dashboard/orders/${payment.orderId}`}
            className="mt-4 inline-flex text-sm font-semibold text-emerald-800 underline-offset-4 hover:underline dark:text-emerald-200"
          >
            View order &amp; receipt →
          </Link>
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm ring-1 ring-border/40 dark:border-white/10 dark:bg-white/[0.03] dark:ring-transparent">
          <h2 className="text-sm font-semibold text-foreground">Details</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="font-medium text-[var(--brand)]">{formatMoney(Number(payment.amount), payment.currency)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Type</dt>
              <dd className="text-foreground">{payment.paymentType.replaceAll("_", " ")}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Provider</dt>
              <dd className="text-foreground">{payment.provider}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">How you pay</dt>
              <dd className="text-right text-foreground">{settlementMethodLabel(payment.settlementMethod)}</dd>
            </div>
            {payment.order?.car ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Vehicle</dt>
                <dd>
                  <Link className="text-[var(--brand)] hover:underline" href={`/cars/${payment.order.car.slug}`}>
                    {payment.order.car.title}
                  </Link>
                </dd>
              </div>
            ) : null}
            {payment.paidAt ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Paid at</dt>
                <dd className="text-foreground/90">{payment.paidAt.toISOString().slice(0, 19).replace("T", " ")}</dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-4 rounded-xl border border-border bg-muted/50 p-3 text-xs text-muted-foreground dark:border-white/10 dark:bg-black/20 dark:text-zinc-400">
            <p className="font-medium text-foreground dark:text-zinc-300">{getSettlementInstructions(payment.settlementMethod).title}</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              {getSettlementInstructions(payment.settlementMethod).lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          {payment.adminNote ? (
            <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3 text-sm text-foreground dark:border-white/10 dark:bg-white/[0.02] dark:text-zinc-300">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-zinc-500">Note from our team</p>
              <p className="mt-1 whitespace-pre-wrap">{payment.adminNote}</p>
            </div>
          ) : null}
        </div>

        <PaymentProofUpload
          paymentId={payment.id}
          status={payment.status}
          settlementMethod={payment.settlementMethod}
        />
      </div>

      {payment.proofs.length > 0 ? (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">Your uploads</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {payment.proofs.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-xl border border-border bg-card dark:border-white/10">
                {isPaymentProofPdfUrl(p.imageUrl) ? (
                  <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-muted dark:bg-zinc-900">
                    <span className="text-xs font-medium text-muted-foreground">PDF</span>
                    <a
                      href={p.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-[var(--brand)] hover:underline"
                    >
                      View PDF
                    </a>
                  </div>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={p.imageUrl} alt="" className="aspect-video w-full object-cover" />
                )}
                <div className="p-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground dark:text-zinc-300">{p.status}</span>
                  {p.note ? <p className="mt-1">{p.note}</p> : null}
                  {p.adminNote ? (
                    <p className="mt-2 border-t border-border pt-2 dark:border-white/10 dark:text-zinc-500">
                      Team: {p.adminNote}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">Status history</h2>
        <ul className="mt-4 space-y-3 border-l border-border pl-4 dark:border-white/10">
          {payment.statusHistory.map((h) => (
            <li key={h.id} className="text-sm">
              <p className="text-xs text-muted-foreground">
                {h.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {h.source}
              </p>
              <p className="text-foreground/90 dark:text-zinc-300">
                {h.fromStatus ? `${h.fromStatus} → ` : ""}
                {h.toStatus}
              </p>
              {h.note ? <p className="mt-0.5 text-muted-foreground">{h.note}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
