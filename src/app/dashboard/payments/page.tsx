import Link from "next/link";

import { PageHeading } from "@/components/typography/page-headings";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { PaymentStatusBadge, WalletLedgerStatusBadge } from "@/components/payments/payment-status-badge";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { formatMoney } from "@/lib/format";
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

export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSessionOrRedirect("/dashboard/payments");
  const userId = session.user.id;
  const sp = await searchParams;

  const paymentPageReq = readPage(sp, "paymentPage");
  const walletPageReq = readPage(sp, "walletPage");
  const pageSize = INTEL_LIST_PAGE_SIZE;

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
    }),
    prisma.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (walletPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const payHref = (next: { paymentPage?: number; walletPage?: number }) => {
    const p = new URLSearchParams();
    const pay = next.paymentPage ?? paymentPage;
    const wal = next.walletPage ?? walletPage;
    if (pay > 1) p.set("paymentPage", String(pay));
    if (wal > 1) p.set("walletPage", String(wal));
    const qs = p.toString();
    return qs ? `/dashboard/payments?${qs}` : "/dashboard/payments";
  };

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
          prevHref={paymentPage > 1 ? payHref({ paymentPage: paymentPage - 1 }) : null}
          nextHref={paymentPage < paymentTotalPages ? payHref({ paymentPage: paymentPage + 1 }) : null}
        />
      ) : null}

      <div className="mt-12">
        <h2 className="text-lg font-semibold text-foreground">Wallet ledger (top-ups and wallet spend)</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Includes Paystack wallet top-ups and wallet debits used for parts checkout. {pageSize} entries per page.
        </p>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-border bg-card shadow-sm ring-1 ring-border/40 dark:border-white/10 dark:bg-white/[0.02] dark:ring-white/[0.06]">
          <table className="w-full min-w-[760px] text-left text-sm text-foreground">
            <thead className="border-b border-border bg-muted/50 text-xs font-medium tracking-wide text-muted-foreground uppercase dark:border-white/10 dark:bg-white/[0.05]">
              <tr>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {walletTotal === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No wallet transactions yet.
                  </td>
                </tr>
              ) : (
                walletTx.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-border/80 last:border-0 dark:border-white/[0.06]"
                  >
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {t.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.reference}</td>
                    <td className="px-4 py-3 text-foreground/90">{t.purpose.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 text-foreground/90">{t.direction}</td>
                    <td className="px-4 py-3 text-muted-foreground">{settlementMethodLabel(t.method)}</td>
                    <td className="px-4 py-3 font-medium text-[var(--brand)]">{formatMoney(Number(t.amount), t.currency)}</td>
                    <td className="px-4 py-3">
                      <WalletLedgerStatusBadge status={t.status} />
                    </td>
                  </tr>
                ))
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
            itemLabel="Wallet ledger"
            prevHref={walletPage > 1 ? payHref({ walletPage: walletPage - 1 }) : null}
            nextHref={walletPage < walletTotalPages ? payHref({ walletPage: walletPage + 1 }) : null}
          />
        ) : null}
      </div>
    </div>
  );
}
