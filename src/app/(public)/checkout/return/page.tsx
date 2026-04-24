import Link from "next/link";

import { PageHeading } from "@/components/typography/page-headings";
import { BrowseCarsCtaLink } from "@/components/storefront/storefront-cta-links";
import { transitionPaymentStatus } from "@/lib/payment-lifecycle";
import { getPaystackSecrets } from "@/lib/payment-provider-registry";
import { paystackVerify } from "@/lib/paystack";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ reference?: string }> };

function paymentTypeLabel(paymentType: string): string {
  if (paymentType === "FULL") return "Full payment";
  if (paymentType === "RESERVATION_DEPOSIT") return "Reservation deposit";
  return paymentType.replaceAll("_", " ");
}

export default async function CheckoutReturnPage(props: Props) {
  const sp = await props.searchParams;
  const reference = sp.reference?.trim();
  if (!reference) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p className="text-base text-zinc-400">
          Missing transaction reference.{" "}
          <Link className="font-medium text-[var(--brand)] hover:underline" href="/dashboard/payments">
            View payments
          </Link>
        </p>
      </div>
    );
  }

  let paystackReportedSuccess = false;
  try {
    const { secretKey } = await getPaystackSecrets();
    if (secretKey) {
      const data = await paystackVerify(reference, secretKey);
      paystackReportedSuccess = data.status === "success";
      if (paystackReportedSuccess) {
        const paidAt = data.paid_at ? new Date(data.paid_at) : undefined;
        const payment = await prisma.payment.findFirst({ where: { providerReference: reference } });
        if (payment && payment.status !== "SUCCESS") {
          await transitionPaymentStatus(payment.id, {
            toStatus: "SUCCESS",
            source: "CHECKOUT_RETURN",
            note: "Verified via Paystack on checkout return",
            receiptData: { reference, verified: true },
            paidAt: paidAt ?? undefined,
          });
        }
      }
    }
  } catch {
    paystackReportedSuccess = false;
  }

  const paymentRow = await prisma.payment.findFirst({
    where: { providerReference: reference },
    include: {
      order: {
        include: {
          car: { select: { title: true, slug: true } },
        },
      },
    },
  });

  if (!paymentRow) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <PageHeading variant="dashboard" className="text-2xl sm:text-3xl">
          Transaction not found
        </PageHeading>
        <p className="mt-4 text-base leading-relaxed text-zinc-400">
          We could not match reference{" "}
          <span className="font-mono text-sm text-zinc-200">{reference}</span> to an order on file. If you were charged,
          contact support with this reference.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className="rounded-xl bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-black"
            href="/contact"
          >
            Contact support
          </Link>
          <BrowseCarsCtaLink className="!min-h-10" href="/inventory" size="compact" />
        </div>
      </div>
    );
  }

  const session = await safeAuth();
  const confirmed = paymentRow.status === "SUCCESS" || paystackReportedSuccess;
  const ownerId = paymentRow.userId;
  const viewerOwns = Boolean(session?.user?.id && ownerId && session.user.id === ownerId);

  const order = paymentRow.order;
  const car = order?.car;
  const paidAt = paymentRow.paidAt;
  const amountPaid = Number(paymentRow.amount);
  const currency = paymentRow.currency || "GHS";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeading
        variant="dashboard"
        className={cn("text-2xl font-semibold tracking-tight sm:text-3xl", confirmed && "text-emerald-400")}
      >
        {confirmed ? "Payment confirmation" : "Confirming your payment"}
      </PageHeading>
      <p className="mt-4 max-w-prose text-base leading-relaxed text-zinc-400 sm:text-lg">
        {confirmed
          ? "Thank you. Your payment has been recorded. A summary of your purchase is below. You will also find this order and any digital receipt in your account."
          : "We could not confirm this payment immediately. If your bank or mobile money wallet was debited, confirmation usually arrives within a few minutes. You can safely close this page and check your dashboard."}
      </p>

      {confirmed ? (
        <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Receipt summary</p>
          <div className="mt-6 space-y-4 text-base">
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
              <span className="text-zinc-500">Transaction reference</span>
              <span className="font-mono text-sm text-zinc-100">{reference}</span>
            </div>
            {order ? (
              <>
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                  <span className="text-zinc-500">Order reference</span>
                  <span className="font-mono text-sm text-zinc-100">{order.reference}</span>
                </div>
                {order.receiptReference ? (
                  <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                    <span className="text-zinc-500">Receipt number</span>
                    <span className="font-mono text-sm text-zinc-100">{order.receiptReference}</span>
                  </div>
                ) : null}
              </>
            ) : null}
            {car ? (
              <div className="flex flex-col gap-1 border-t border-white/10 pt-4 sm:flex-row sm:justify-between sm:gap-4">
                <span className="text-zinc-500">Vehicle</span>
                <span className="max-w-md text-right font-medium text-white sm:text-left">
                  {viewerOwns ? (
                    <Link className="text-[var(--brand)] hover:underline" href={`/cars/${car.slug}`}>
                      {car.title}
                    </Link>
                  ) : (
                    car.title
                  )}
                </span>
              </div>
            ) : null}
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
              <span className="text-zinc-500">Payment type</span>
              <span className="font-medium text-zinc-100">{paymentTypeLabel(paymentRow.paymentType)}</span>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
              <span className="text-zinc-500">Amount paid</span>
              <span className="text-xl font-bold text-[var(--brand)]">{formatMoney(amountPaid, currency)}</span>
            </div>
            {paidAt ? (
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                <span className="text-zinc-500">Paid at</span>
                <span className="text-zinc-200">{formatDate(paidAt)}</span>
              </div>
            ) : null}
            {order?.orderStatus ? (
              <div className="flex flex-col gap-1 border-t border-white/10 pt-4 sm:flex-row sm:justify-between sm:gap-4">
                <span className="text-zinc-500">Order status</span>
                <span className="font-medium text-zinc-100">{order.orderStatus.replaceAll("_", " ")}</span>
              </div>
            ) : null}
          </div>

          {viewerOwns && order ? (
            <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-8 sm:flex-row sm:flex-wrap">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--brand)] px-6 text-sm font-semibold text-black"
                href={`/dashboard/orders/${order.id}`}
              >
                View order &amp; updates
              </Link>
              {order.receiptPdfUrl ? (
                <a
                  href={order.receiptPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 px-6 text-sm font-semibold text-white hover:bg-white/5"
                >
                  Download PDF receipt
                </a>
              ) : (
                <p className="self-center text-sm text-zinc-500">
                  Your PDF receipt will appear on the order page once generated.
                </p>
              )}
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-6 text-sm font-medium text-zinc-300 hover:bg-white/5"
                href={`/dashboard/payments/${paymentRow.id}`}
              >
                Payment detail
              </Link>
            </div>
          ) : confirmed ? (
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-sm leading-relaxed text-zinc-400">
                {session?.user?.id && !viewerOwns
                  ? "This payment is linked to a different account. Sign in with the email you used at checkout to view the full receipt and order timeline."
                  : "Sign in with the account you used to pay to view your order timeline, receipt downloads, and shipment updates."}
              </p>
              <Link
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--brand)] px-6 text-sm font-semibold text-black"
                href={`/login?callbackUrl=${encodeURIComponent(order ? `/dashboard/orders/${order.id}` : "/dashboard/orders")}`}
              >
                Sign in
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-10 rounded-3xl border border-amber-500/25 bg-amber-500/5 p-6">
          <p className="text-base leading-relaxed text-amber-100/90">
            Reference <span className="font-mono text-amber-50">{reference}</span>. Check{" "}
            <Link className="font-semibold text-[var(--brand)] hover:underline" href="/dashboard/payments">
              payment history
            </Link>{" "}
            in a few minutes, or open your order from{" "}
            <Link className="font-semibold text-[var(--brand)] hover:underline" href="/dashboard/orders">
              orders
            </Link>
            .
          </p>
        </div>
      )}

      <div className="mt-10 flex flex-wrap gap-3">
        <Link className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-medium text-white" href="/">
          Home
        </Link>
        <BrowseCarsCtaLink className="!min-h-10" href="/inventory" size="compact" />
      </div>
    </div>
  );
}
