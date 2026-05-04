import Link from "next/link";
import { DisputeCaseStatus, DisputeCaseType, DisputePriority, Prisma } from "@prisma/client";

import { openDisputeCaseAction } from "@/actions/disputes-admin";
import { PageHeading } from "@/components/typography/page-headings";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readParam(sp: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const raw = sp[key];
  return typeof raw === "string" ? raw.trim() || undefined : Array.isArray(raw) ? raw[0]?.trim() || undefined : undefined;
}

export default async function AdminDisputesPage(props: { searchParams: SearchParams }) {
  await requireAdmin();
  const sp = await props.searchParams;
  const q = readParam(sp, "q");
  const status = readParam(sp, "status");
  const type = readParam(sp, "type");
  const priority = readParam(sp, "priority");
  const from = readParam(sp, "from");
  const to = readParam(sp, "to");

  const where: Prisma.DisputeCaseWhereInput = {
    ...(status && Object.values(DisputeCaseStatus).includes(status as DisputeCaseStatus)
      ? { status: status as DisputeCaseStatus }
      : {}),
    ...(type && Object.values(DisputeCaseType).includes(type as DisputeCaseType) ? { type: type as DisputeCaseType } : {}),
    ...(priority && Object.values(DisputePriority).includes(priority as DisputePriority)
      ? { priority: priority as DisputePriority }
      : {}),
    ...(q
      ? {
          OR: [
            { caseNumber: { contains: q, mode: "insensitive" } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { reason: { contains: q, mode: "insensitive" } },
            { payment: { providerReference: { contains: q, mode: "insensitive" } } },
            { order: { reference: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(from || to
      ? {
          openedAt: {
            ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  };

  const [rows, metrics] = await Promise.all([
    prisma.disputeCase.findMany({
      where,
      orderBy: [{ priority: "desc" }, { openedAt: "desc" }],
      take: 120,
      include: {
        user: { select: { email: true, name: true } },
        payment: { select: { id: true, providerReference: true, status: true } },
        order: { select: { id: true, reference: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.disputeCase.groupBy({
      by: ["status", "priority"],
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  const startMonth = new Date();
  startMonth.setUTCDate(1);
  startMonth.setUTCHours(0, 0, 0, 0);
  const [resolvedThisMonth, awaitingCustomer] = await Promise.all([
    prisma.disputeCase.count({
      where: {
        status: { in: [DisputeCaseStatus.RESOLVED_APPROVED, DisputeCaseStatus.RESOLVED_REJECTED, DisputeCaseStatus.REFUNDED] },
        resolvedAt: { gte: startMonth },
      },
    }),
    prisma.disputeCase.count({ where: { status: DisputeCaseStatus.AWAITING_CUSTOMER_RESPONSE } }),
  ]);
  const openDisputes = metrics.filter((m) => !["CLOSED", "RESOLVED_APPROVED", "RESOLVED_REJECTED", "REFUNDED"].includes(m.status)).reduce((s, m) => s + m._count._all, 0);
  const criticalDisputes = metrics.filter((m) => m.priority === "CRITICAL").reduce((s, m) => s + m._count._all, 0);
  const totalDisputedAmount = metrics.reduce((s, m) => s + Number(m._sum.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <PageHeading variant="dashboard">Dispute & chargeback defense</PageHeading>
          <p className="mt-2 text-sm text-zinc-400">
            Manage disputes, collect legal-grade evidence, and protect payment/order operations with full audit trail controls.
          </p>
        </div>
        <Link href="/admin/payments/intelligence" className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white hover:bg-white/10">
          Open payment intelligence
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card label="Open disputes" value={String(openDisputes)} />
        <Card label="Critical disputes" value={String(criticalDisputes)} />
        <Card label="Awaiting customer" value={String(awaitingCustomer)} />
        <Card label="Resolved this month" value={String(resolvedThisMonth)} />
        <Card label="Total disputed amount" value={`GH₵ ${totalDisputedAmount.toLocaleString()}`} />
      </section>

      <form className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-3 lg:grid-cols-6">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Case, user, payment ref, order ref"
          className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white sm:col-span-2"
        />
        <select name="status" defaultValue={status ?? ""} className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white">
          <option value="">All statuses</option>
          {Object.values(DisputeCaseStatus).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={type ?? ""} className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white">
          <option value="">All types</option>
          {Object.values(DisputeCaseType).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select
          name="priority"
          defaultValue={priority ?? ""}
          className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
        >
          <option value="">All priorities</option>
          {Object.values(DisputePriority).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <button type="submit" className="h-10 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black">
          Apply filters
        </button>
        <input name="from" type="date" defaultValue={from ?? ""} className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white" />
        <input name="to" type="date" defaultValue={to ?? ""} className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white" />
      </form>

      <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <summary className="cursor-pointer text-sm font-semibold text-white">Open dispute case</summary>
        <form action={openDisputeCaseAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <select required name="type" className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white">
            {Object.values(DisputeCaseType).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <select name="priority" className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white">
            {Object.values(DisputePriority).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <input name="userId" placeholder="User ID (optional)" className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white" />
          <input name="paymentId" placeholder="Payment ID (optional)" className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white" />
          <input name="orderId" placeholder="Order ID (optional)" className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white" />
          <input name="receiptId" placeholder="Receipt ID (optional)" className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white" />
          <input name="amount" type="number" step="0.01" placeholder="Amount (optional)" className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white" />
          <input name="currency" placeholder="Currency (e.g., GHS)" className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white" />
          <textarea name="reason" required placeholder="Case reason" className="min-h-24 rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white sm:col-span-2" />
          <textarea
            name="customerClaim"
            placeholder="Customer claim (optional)"
            className="min-h-20 rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white sm:col-span-2"
          />
          <textarea
            name="adminSummary"
            placeholder="Internal admin summary (optional)"
            className="min-h-20 rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white sm:col-span-2"
          />
          <button type="submit" className="h-10 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black sm:w-fit">
            Create dispute case
          </button>
        </form>
      </details>

      <section className="sda-table-scroll rounded-2xl border border-white/10 bg-white/[0.03]">
        <table className="min-w-full text-sm">
          <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-wide text-zinc-400">
            <tr>
              <th className="px-4 py-3">Case</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Links</th>
              <th className="px-4 py-3">Opened</th>
              <th className="px-4 py-3">Assigned</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-white/10">
                <td className="px-4 py-3 font-medium text-white">{row.caseNumber}</td>
                <td className="px-4 py-3 text-zinc-300">{row.user?.email ?? "Guest/Unlinked"}</td>
                <td className="px-4 py-3 text-zinc-300">{row.type}</td>
                <td className="px-4 py-3 text-zinc-300">{row.amount ? `${row.currency ?? "GHS"} ${Number(row.amount).toLocaleString()}` : "-"}</td>
                <td className="px-4 py-3 text-zinc-300">{row.status}</td>
                <td className="px-4 py-3 text-zinc-300">{row.priority}</td>
                <td className="px-4 py-3 text-xs text-zinc-400">
                  {row.payment ? `Payment:${row.payment.providerReference ?? row.payment.id.slice(0, 8)}` : "-"}
                  <br />
                  {row.order ? `Order:${row.order.reference}` : "-"}
                </td>
                <td className="px-4 py-3 text-zinc-400">{row.openedAt.toISOString().slice(0, 10)}</td>
                <td className="px-4 py-3 text-zinc-400">{row.assignedTo?.email ?? "-"}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/disputes/${row.id}`} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/10">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-5 text-sm text-zinc-400" colSpan={10}>
                  No disputes match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}
