import Link from "next/link";

import { PageHeading } from "@/components/typography/page-headings";
import { BrowseCarsCtaLink } from "@/components/storefront/storefront-cta-links";
import { transitionPaymentStatus } from "@/lib/payment-lifecycle";
import { getPaystackSecrets } from "@/lib/payment-provider-registry";
import { paystackVerify } from "@/lib/paystack";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";
import { formatDate, formatMoney, safeDateToIso } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ reference?: string }> };

/** Prisma `select` only for fields that exist on current schema (avoids runtime errors if client is out of sync). */
const checkoutReturnPaymentSelect = {
  id: true,
  orderId: true,
  userId: true,
  providerReference: true,
  amount: true,
  currency: true,
  status: true,
  paymentType: true,
  paidAt: true,
  order: {
    select: {
      id: true,
      reference: true,
      receiptReference: true,
      receiptPdfUrl: true,
      orderStatus: true,
      amount: true,
      currency: true,
      kind: true,
      depositAmount: true,
      remainingBalance: true,
      orderDepositPercentSnapshot: true,
      reservedAt: true,
      balanceDueAt: true,
      balanceStatus: true,
      vehicleListPriceGhs: true,
      car: {
        select: {
          title: true,
          slug: true,
          price: true,
          currency: true,
          basePriceAmount: true,
          basePriceCurrency: true,
        },
      },
    },
  },
} as const;

function safeDecimalToNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function safeString(v: unknown, fallback = ""): string {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return fallback;
}

function paymentTypeLabel(paymentType: string | null | undefined): string {
  const t = safeString(paymentType, "");
  if (!t) return "—";
  if (t === "FULL") return "Full payment";
  if (t === "RESERVATION_DEPOSIT") return "Reservation deposit";
  return t.replaceAll("_", " ");
}

function formatOrderStatus(status: string | null | undefined): string {
  const s = safeString(status, "");
  return s ? s.replaceAll("_", " ") : "—";
}

function carListPriceLine(car: {
  price: unknown;
  currency: string | null;
  basePriceAmount: unknown;
  basePriceCurrency: string | null;
} | null | undefined): { label: string; value: string } | null {
  if (!car) return null;
  const listGhs = safeDecimalToNumber(car.price);
  const listCur = safeString(car.currency, "GHS");
  if (listGhs != null) {
    return { label: "Vehicle list price (display)", value: formatMoney(listGhs, listCur) };
  }
  const base = safeDecimalToNumber(car.basePriceAmount);
  const baseCur = safeString(car.basePriceCurrency, "GHS");
  if (base != null) {
    return { label: "Vehicle base price", value: formatMoney(base, baseCur) };
  }
  return null;
}

function PostPaymentErrorFallback({ reference }: { reference: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <PageHeading variant="dashboard" className="text-2xl sm:text-3xl">
        Something went wrong
      </PageHeading>
      <p className="mt-4 text-base leading-relaxed text-zinc-400">
        We could not load your payment confirmation. If you were charged, keep reference{" "}
        <span className="font-mono text-sm text-zinc-200">{reference}</span> and check{" "}
        <Link className="font-medium text-[var(--brand)] hover:underline" href="/dashboard/payments">
          payment history
        </Link>{" "}
        or contact support.
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

  try {
    let paystackReportedSuccess = false;
    try {
      const { secretKey } = await getPaystackSecrets();
      if (secretKey) {
        const verifyData = await paystackVerify(reference, secretKey);
        paystackReportedSuccess = verifyData.status === "success";
        if (paystackReportedSuccess) {
          const paidAt = verifyData.paid_at ? new Date(verifyData.paid_at) : undefined;
          const paymentLookup = await prisma.payment.findFirst({
            where: { providerReference: reference },
            select: { id: true, status: true },
          });
          if (paymentLookup && paymentLookup.status !== "SUCCESS") {
            await transitionPaymentStatus(paymentLookup.id, {
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
      select: checkoutReturnPaymentSelect,
    });

    if (!paymentRow) {
      console.info("[checkout/return] payment row not found", {
        reference,
        paystackReportedSuccess,
      });
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

    let session: Awaited<ReturnType<typeof safeAuth>> = null;
    try {
      session = await safeAuth();
    } catch {
      session = null;
    }

    const confirmed = paymentRow.status === "SUCCESS" || paystackReportedSuccess;
    const ownerId = paymentRow.userId ?? null;
    const sessionUserId = session?.user?.id ?? null;
    const viewerOwns = Boolean(sessionUserId && ownerId && sessionUserId === ownerId);

    const order = paymentRow.order ?? null;
    const car = order?.car ?? null;
    const paidAt = paymentRow.paidAt ?? null;
    const amountPaid = safeDecimalToNumber(paymentRow.amount) ?? 0;
    const currency = safeString(paymentRow.currency, "GHS") || "GHS";
    const orderTotal = order ? safeDecimalToNumber(order.amount) : null;
    const orderCurrency = order ? safeString(order.currency, currency) || currency : currency;
    const carTitle = car ? safeString(car.title, "Vehicle") : "";
    const carSlug = car ? safeString(car.slug, "") : "";
    const listPriceRow = carListPriceLine(car);

    console.info("[checkout/return] confirmation", {
      reference,
      paymentId: paymentRow.id,
      paymentStatus: paymentRow.status,
      paymentType: paymentRow.paymentType,
      orderId: order?.id ?? null,
      orderStatus: order?.orderStatus ?? null,
      paystackReportedSuccess,
      confirmed,
      paidAtIso: safeDateToIso(paidAt),
      balanceDueAtIso: order?.balanceDueAt != null ? safeDateToIso(order.balanceDueAt) : null,
      viewerOwns,
    });

    const isVehicleDeposit = paymentRow.paymentType === "RESERVATION_DEPOSIT";
    const remainingBalanceNum =
      order?.remainingBalance != null ? safeDecimalToNumber(order.remainingBalance) : null;
    const depositPctNum =
      order?.orderDepositPercentSnapshot != null
        ? safeDecimalToNumber(order.orderDepositPercentSnapshot)
        : null;

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

        {confirmed && isVehicleDeposit ? (
          <div className="mt-8 rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.08] p-5 text-sm leading-relaxed text-zinc-100">
            <p className="font-semibold text-emerald-200/95">Deposit paid</p>
            <p className="mt-2 text-zinc-200">
              <span className="text-emerald-300/95">✓</span> We received{" "}
              <span className="font-semibold text-white">{formatMoney(amountPaid, currency)}</span>
              {depositPctNum != null ? (
                <>
                  {" "}
                  as your reservation deposit ({depositPctNum}% of list price basis).
                </>
              ) : (
                " as your reservation deposit."
              )}
            </p>
            {remainingBalanceNum != null ? (
              <p className="mt-2 text-zinc-300">
                Remaining balance:{" "}
                <span className="font-semibold text-white">{formatMoney(remainingBalanceNum, orderCurrency)}</span>
              </p>
            ) : null}
            {order?.balanceDueAt ? (
              <p className="mt-3 text-xs text-zinc-400">
                Balance due by{" "}
                <span className="font-medium text-zinc-200">{formatDate(order.balanceDueAt)}</span> (21 days from your
                deposit).
              </p>
            ) : null}
            <p className="mt-4 text-xs leading-relaxed text-zinc-500">
              Your vehicle is reserved. Our team will contact you to complete the remaining balance within the allowed
              window.
            </p>
          </div>
        ) : null}

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
                    <span className="font-mono text-sm text-zinc-100">
                      {safeString(order.reference, "—")}
                    </span>
                  </div>
                  {order.receiptReference ? (
                    <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                      <span className="text-zinc-500">Receipt number</span>
                      <span className="font-mono text-sm text-zinc-100">{order.receiptReference}</span>
                    </div>
                  ) : null}
                  {orderTotal != null ? (
                    <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                      <span className="text-zinc-500">Order total</span>
                      <span className="font-medium text-zinc-100">{formatMoney(orderTotal, orderCurrency)}</span>
                    </div>
                  ) : null}
                </>
              ) : null}
              {car && carTitle ? (
                <div className="flex flex-col gap-1 border-t border-white/10 pt-4 sm:flex-row sm:justify-between sm:gap-4">
                  <span className="text-zinc-500">Vehicle</span>
                  <span className="max-w-md text-right font-medium text-white sm:text-left">
                    {viewerOwns && carSlug ? (
                      <Link className="text-[var(--brand)] hover:underline" href={`/cars/${carSlug}`}>
                        {carTitle}
                      </Link>
                    ) : (
                      carTitle
                    )}
                  </span>
                </div>
              ) : null}
              {listPriceRow ? (
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                  <span className="text-zinc-500">{listPriceRow.label}</span>
                  <span className="text-zinc-200">{listPriceRow.value}</span>
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
              {order ? (
                <div className="flex flex-col gap-1 border-t border-white/10 pt-4 sm:flex-row sm:justify-between sm:gap-4">
                  <span className="text-zinc-500">Order status</span>
                  <span className="font-medium text-zinc-100">{formatOrderStatus(order.orderStatus)}</span>
                </div>
              ) : null}
            </div>

            {viewerOwns && order?.id ? (
              <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-8 sm:flex-row sm:flex-wrap">
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--brand)] px-6 text-sm font-semibold text-black"
                  href={`/dashboard/orders/${order.id}`}
                >
                  View order &amp; updates
                </Link>
                {order.receiptPdfUrl ? (
                  <>
                    <Link
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 px-6 text-sm font-semibold text-white hover:bg-white/5"
                      href={`/dashboard/orders/${order.id}/receipt`}
                    >
                      Preview PDF receipt
                    </Link>
                    <a
                      href={`/api/orders/${order.id}/receipt/download`}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 px-6 text-sm font-semibold text-white hover:bg-white/5"
                    >
                      Download PDF receipt
                    </a>
                  </>
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
                  {sessionUserId && !viewerOwns
                    ? "This payment is linked to a different account. Sign in with the email you used at checkout to view the full receipt and order timeline."
                    : "Sign in with the account you used to pay to view your order timeline, receipt downloads, and shipment updates."}
                </p>
                <Link
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--brand)] px-6 text-sm font-semibold text-black"
                  href={`/login?callbackUrl=${encodeURIComponent(order?.id ? `/dashboard/orders/${order.id}` : "/dashboard/orders")}`}
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
  } catch (err) {
    console.error("[checkout/return] render failed", {
      reference,
      error: err instanceof Error ? err.message : String(err),
      ...(err instanceof Error && err.stack ? { stack: err.stack } : {}),
    });
    return <PostPaymentErrorFallback reference={reference} />;
  }
}
