import Link from "next/link";

import { PageHeading } from "@/components/typography/page-headings";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  buildDepositBalancesWhere,
  type DepositBalanceAdminFilter,
} from "@/lib/deposit-balance-query";
import { isDepositBalanceReminderEmailConfigured } from "@/lib/deposit-balance-reminder-email";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { DepositBalanceRowActions } from "./deposit-balance-row-actions";

export const dynamic = "force-dynamic";

function parseFilter(raw: string | undefined): DepositBalanceAdminFilter {
  const v = raw?.trim();
  if (
    v === "due_soon" ||
    v === "overdue" ||
    v === "paid" ||
    v === "reserved_with_deposit"
  ) {
    return v;
  }
  return "all";
}

export default async function AdminDepositBalancesPage(props: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireAdmin();
  const sp = await props.searchParams;
  const filter = parseFilter(sp.filter);
  const where = buildDepositBalancesWhere(filter);

  const rows = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      reference: true,
      orderStatus: true,
      balanceStatus: true,
      followUpRequired: true,
      balanceDueAt: true,
      depositAmount: true,
      remainingBalance: true,
      vehicleListPriceGhs: true,
      orderDepositPercentSnapshot: true,
      balanceReminderCount: true,
      lastBalanceReminderAt: true,
      paymentType: true,
      createdAt: true,
      reservedAt: true,
      user: {
        select: { id: true, name: true, email: true, phone: true },
      },
      car: { select: { id: true, title: true, slug: true } },
      payments: {
        where: { status: "SUCCESS" },
        orderBy: { paidAt: "desc" },
        take: 1,
        select: { paidAt: true, amount: true, status: true },
      },
    },
  });

  const emailReady = isDepositBalanceReminderEmailConfigured();
  const now = Date.now();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeading variant="dashboard" className="text-2xl">
        Deposit balances
      </PageHeading>
      <p className="mt-2 max-w-prose text-sm text-zinc-400">
        Vehicle reservation deposits and outstanding balances. Balance is due within 21 days of the deposit payment.
        Email reminders use Resend when{" "}
        <code className="rounded bg-white/10 px-1 py-0.5 text-xs">RESEND_API_KEY</code> and a from-address are set.
        Status: <span className="text-emerald-300/90">{emailReady ? "email ready" : "email not configured"}</span>.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["reserved_with_deposit", "Reserved · deposit"],
            ["due_soon", "Due soon"],
            ["overdue", "Overdue / follow-up"],
            ["paid", "Paid / settled"],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={key === "all" ? "/admin/deposit-balances" : `/admin/deposit-balances?filter=${key}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              filter === key
                ? "border-[var(--brand)] bg-[var(--brand)]/15 text-white"
                : "border-white/15 text-zinc-300 hover:bg-white/5"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Full price (GHS)</th>
              <th className="px-4 py-3">Deposit</th>
              <th className="px-4 py-3">Remaining</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-zinc-500">
                  No orders match this filter.
                </td>
              </tr>
            ) : (
              rows.map((o) => {
                const full =
                  o.vehicleListPriceGhs != null
                    ? Number(o.vehicleListPriceGhs)
                    : o.depositAmount != null && o.remainingBalance != null
                      ? Number(o.depositAmount) + Number(o.remainingBalance)
                      : null;
                const dep = o.depositAmount != null ? Number(o.depositAmount) : null;
                const rem = o.remainingBalance != null ? Number(o.remainingBalance) : null;
                const dueAt = o.balanceDueAt;
                let daysLabel = "—";
                if (dueAt && rem != null && rem > 0) {
                  const d = Math.ceil((dueAt.getTime() - now) / 86_400_000);
                  daysLabel = d >= 0 ? `${d}d left` : `${Math.abs(d)}d overdue`;
                }
                const name = o.user?.name?.trim() || "—";
                const email = o.user?.email ?? "—";
                const phone = o.user?.phone?.trim() || "—";
                const paidAt = o.payments[0]?.paidAt;
                const outstanding = rem != null && rem > 0;
                return (
                  <tr key={o.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 align-top text-zinc-200">
                      <div className="font-medium text-white">{name}</div>
                      <div className="text-xs text-zinc-500">{email}</div>
                      <div className="text-xs text-zinc-500">{phone}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-zinc-300">
                      {o.car?.slug ? (
                        <Link className="text-[var(--brand)] hover:underline" href={`/cars/${o.car.slug}`}>
                          {o.car.title}
                        </Link>
                      ) : (
                        o.car?.title ?? "—"
                      )}
                      <div className="font-mono text-[10px] text-zinc-600">{o.reference}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-zinc-200">
                      {full != null ? formatMoney(full, "GHS") : "—"}
                    </td>
                    <td className="px-4 py-3 align-top">{dep != null ? formatMoney(dep, "GHS") : "—"}</td>
                    <td className="px-4 py-3 align-top">{rem != null ? formatMoney(rem, "GHS") : "—"}</td>
                    <td className="px-4 py-3 align-top text-xs text-zinc-400">
                      {dueAt ? dueAt.toISOString().slice(0, 10) : "—"}
                      <div className="text-zinc-500">{daysLabel}</div>
                      {paidAt ? <div className="mt-1 text-[10px] text-zinc-600">Deposit paid {paidAt.toISOString().slice(0, 10)}</div> : null}
                    </td>
                    <td className="px-4 py-3 align-top text-xs">
                      <div className="text-zinc-200">{o.orderStatus.replaceAll("_", " ")}</div>
                      <div className="text-zinc-500">{o.balanceStatus?.replaceAll("_", " ") ?? "—"}</div>
                      {o.followUpRequired ? (
                        <span className="mt-1 inline-block rounded bg-amber-500/20 px-2 py-0.5 text-amber-100">
                          Follow-up
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <DepositBalanceRowActions orderId={o.id} canRemind={outstanding && emailReady} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
