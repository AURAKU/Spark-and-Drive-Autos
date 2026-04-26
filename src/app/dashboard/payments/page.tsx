import Link from "next/link";
import { unstable_cache } from "next/cache";

import { PageHeading } from "@/components/typography/page-headings";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { PaymentStatusBadge, WalletLedgerStatusBadge } from "@/components/payments/payment-status-badge";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { formatMoney } from "@/lib/format";
import { OPS_ROUTE_CACHE_TAGS } from "@/lib/ops-route-cache-tags";
import { INTEL_LIST_PAGE_SIZE, normalizeIntelListPage } from "@/lib/ops";
import { settlementMethodLabel } from "@/lib/payment-settlement";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readPage(sp: Record<string, string | string[] | undefined>, key: string): number {
  const v = sp[key];
  const s = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  if (s == null || s === "") return 1;
  const n = parseInt(s, 10);
  return normalizeIntelListPage(Number.isFinite(n) ? n : undefined);
}

const getDashboardPaymentsData = unstable_cache(
  async (userId: string, paymentPageReq: number, walletPageReq: number, pageSize: number) => {
    const [paymentTotal, walletTotal] = await Promise.all([
      prisma.payment.count({ where: { userId } }),
      prisma.walletTransaction.count({ where: { userId } }),
    ]);

    const paymentTotalPages = Math.max(1, Math.ceil(Math.max(0, paymentTotal) / pageSize));
    const walletTotalPages = Math.max(1, Math.ceil(Math.max(0, walletTotal) / pageSize));
    const paymentPage = Math.min(Math.max(1, paymentPageReq), paymentTotalPages);
    const walletPage = Math.min(Math.max(1, walletPageReq), walletTotalPages);

    const [payments, walletTx] = await Promise.all([
      prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (paymentPage - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          providerReference: true,
          paymentType: true,
          settlementMethod: true,
          status: true,
          amount: true,
          currency: true,
        },
      }),
      prisma.walletTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (walletPage - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          createdAt: true,
          reference: true,
          purpose: true,
          method: true,
          amount: true,
          currency: true,
          status: true,
        },
      }),
    ]);

    return {
      paymentTotal,
      walletTotal,
      paymentTotalPages,
      walletTotalPages,
      paymentPage,
      walletPage,
      payments,
      walletTx,
    };
  },
  ["ops-dashboard-payments-page:v1"],
  { revalidate: 15, tags: [OPS_ROUTE_CACHE_TAGS.dashboardPayments] },
);

export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSessionOrRedirect("/dashboard/payments");
  const userId = session.user.id;
  const sp = await searchParams;

  const paymentPageReq = readPage(sp, "paymentPage");
  const walletPageReq = readPage(sp, "walletPage");
  const pageSize = INTEL_LIST_PAGE_SIZE;

  const {
    paymentTotal,
    walletTotal,
    paymentTotalPages,
    walletTotalPages,
    paymentPage,
    walletPage,
    payments,
    walletTx,
  } = await getDashboardPaymentsData(userId, paymentPageReq, walletPageReq, pageSize);

  const payHref = (next: { paymentPage?: number; walletPage?: number }) => {
    const p = new URLSearchParams();
    const pay = next.paymentPage ?? paymentPage;
    const wal = next.walletPage ?? walletPage;
    if (pay > 1) p.set("paymentPage", String(pay));
    if (wal > 1) p.set("walletPage", String(wal));
    const qs = p.toString();
    return qs ? `/dashboard/payments?${qs}` : "/dashboard/payments";
  };

  const paymentPageHrefs =
    paymentTotalPages > 1
      ? Array.from({ length: paymentTotalPages }, (_, i) => payHref({ paymentPage: i + 1 }))
      : undefined;
  const walletPageHrefs =
    walletTotalPages > 1
      ? Array.from({ length: walletTotalPages }, (_, i) => payHref({ walletPage: i + 1 }))
      : undefined;

  return (
    <div>
      <PageHeading variant="dashboard">Payments</PageHeading>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Receipt references, Paystack status, and any screenshots you upload for manual verification.
      </p>
      <div className="mt-8 space-y-3">
        {paymentTotal === 0 ? (
          <p className="text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          payments.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/payments/${p.id}`}
              className="block rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm ring-1 ring-border/40 transition hover:bg-muted/50 hover:ring-[var(--brand)]/25 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none dark:ring-white/[0.06] dark:hover:bg-white/[0.07]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{p.providerReference ?? p.id.slice(0, 12)}</p>
                  <p className="text-sm font-medium text-foreground">{p.paymentType.replaceAll("_", " ")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{settlementMethodLabel(p.settlementMethod)}</p>
                </div>
                <div className="text-right">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <PaymentStatusBadge status={p.status} />
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[var(--brand)]">{formatMoney(Number(p.amount), p.currency)}</p>
                </div>
              </div>
              <span className="mt-3 inline-block text-sm font-medium text-[var(--brand)] hover:underline">Details &amp; proof →</span>
            </Link>
          ))
        )}
      </div>
      {paymentTotal > 0 ? (
        <ListPaginationFooter
          pageSize={pageSize}
          page={paymentPage}
          totalPages={paymentTotalPages}
          totalItems={paymentTotal}
          itemLabel="Payments"
          pageHrefs={paymentPageHrefs}
          prevHref={paymentPage > 1 ? payHref({ paymentPage: paymentPage - 1 }) : null}
          nextHref={paymentPage < paymentTotalPages ? payHref({ paymentPage: paymentPage + 1 }) : null}
        />
      ) : null}

      <div className="mt-12">
        <h2 className="text-lg font-semibold text-foreground">Wallet History (Top-ups and Wallet Debits)</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Includes Secured Payment wallet top-ups and wallet debits used for parts checkout. {pageSize} entries per page.
        </p>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-border bg-card shadow-sm ring-1 ring-border/40 dark:border-white/10 dark:bg-white/[0.02] dark:ring-white/[0.06]">
          <table className="w-full min-w-[min(100%,36rem)] table-fixed border-separate border-spacing-0 text-left text-[10px] leading-snug text-foreground sm:min-w-[36rem] sm:text-[11px]">
            <colgroup>
              <col className="w-[10%] sm:w-[9%]" />
              <col className="w-[12%] sm:w-[10%]" />
              <col className="w-[32%] sm:w-[32%]" />
              <col className="w-[16%] sm:w-[16%]" />
              <col className="w-[16%] sm:w-[16%]" />
              <col className="w-[14%] sm:w-[17%]" />
            </colgroup>
            <thead className="border-b border-border bg-muted/50 text-[9px] font-medium tracking-wider text-muted-foreground sm:text-[10px] sm:tracking-wide dark:border-white/10 dark:bg-white/[0.05]">
              <tr>
                <th className="px-2 py-2 text-left sm:px-2.5">Created</th>
                <th className="px-1 py-2 text-left sm:px-2">Ref.</th>
                <th className="px-1 py-2 text-left sm:px-2">Purpose</th>
                <th className="px-1 py-2 text-left sm:px-2">Method</th>
                <th className="px-1 py-2 text-right sm:px-2">Amount</th>
                <th className="px-1.5 py-2 text-left sm:pl-2 sm:pr-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {walletTotal === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No wallet transactions yet.
                  </td>
                </tr>
              ) : (
                walletTx.map((t) => {
                  const purpose = t.purpose.replaceAll("_", " ");
                  return (
                    <tr
                      key={t.id}
                      className="align-top border-b border-border/80 last:border-0 dark:border-white/[0.06]"
                    >
                      <td className="px-2 py-2 font-mono text-[9px] text-muted-foreground sm:px-2.5 sm:text-[10px]">
                        {t.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                      </td>
                      <td
                        className="max-w-0 break-all px-1 py-2 font-mono text-[9px] text-muted-foreground sm:px-2 sm:text-[10px]"
                        title={t.reference}
                      >
                        {t.reference}
                      </td>
                      <td className="min-w-0 break-words px-1 py-2 text-foreground/95 sm:px-2" title={purpose}>
                        {purpose}
                      </td>
                      <td className="break-words px-1 py-2 text-muted-foreground sm:px-2" title={settlementMethodLabel(t.method)}>
                        {settlementMethodLabel(t.method)}
                      </td>
                      <td className="whitespace-nowrap px-1 py-2 text-right font-medium tabular-nums text-[var(--brand)] sm:px-2">
                        {formatMoney(Number(t.amount), t.currency)}
                      </td>
                      <td className="px-1.5 py-1.5 sm:pl-2 sm:pr-2">
                        <span className="inline-block [&>span]:!px-1.5 [&>span]:!py-0.5 [&>span]:!text-[9px] sm:[&>span]:!text-[10px]">
                          <WalletLedgerStatusBadge status={t.status} />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {walletTotal > 0 ? (
          <ListPaginationFooter
            pageSize={pageSize}
            page={walletPage}
            totalPages={walletTotalPages}
            totalItems={walletTotal}
            itemLabel="Wallet history"
            pageHrefs={walletPageHrefs}
            prevHref={walletPage > 1 ? payHref({ walletPage: walletPage - 1 }) : null}
            nextHref={walletPage < walletTotalPages ? payHref({ walletPage: walletPage + 1 }) : null}
          />
        ) : null}
      </div>
    </div>
  );
}
