import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createContractVersion,
  createPolicyVersion,
  createUserRiskTag,
  resolveUserRiskTag,
  updatePaymentLegalControl,
} from "@/actions/legal-admin";
import { PageHeading } from "@/components/typography/page-headings";
import { isAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

export const dynamic = "force-dynamic";

export default async function AdminLegalPage() {
  const session = await safeAuth();
  if (!session?.user?.id || !session.user.role || !isAdminRole(session.user.role)) {
    redirect("/admin");
  }

  const [policyVersions, contractTemplates, agreementLogs, contracts, risks, verifications, users, riskTags, walletTxns, riskEvents, disputes, auditLogs] = await Promise.all([
    prisma.policyVersion.findMany({ orderBy: [{ policyKey: "asc" }, { effectiveAt: "desc" }], take: 120 }),
    prisma.contract.findMany({ orderBy: [{ type: "asc" }, { createdAt: "desc" }], take: 80 }),
    prisma.agreementLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      include: { user: { select: { email: true } }, order: { select: { reference: true } } },
    }),
    prisma.contractAcceptance.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      include: { user: { select: { email: true } }, order: { select: { reference: true } } },
    }),
    prisma.riskAcknowledgement.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      include: { user: { select: { email: true } }, order: { select: { reference: true } } },
    }),
    prisma.paymentVerification.findMany({
      orderBy: { updatedAt: "desc" },
      take: 80,
      include: { payment: { select: { id: true, providerReference: true, status: true } } },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 120,
      select: { id: true, email: true },
    }),
    prisma.userRiskTag.findMany({
      orderBy: { createdAt: "desc" },
      take: 120,
      include: { user: { select: { email: true } }, createdBy: { select: { email: true } } },
    }),
    prisma.walletTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { email: true } }, order: { select: { reference: true } } },
    }),
    prisma.riskEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { email: true } } },
    }),
    prisma.paymentVerification.findMany({
      where: { disputed: true },
      orderBy: { updatedAt: "desc" },
      take: 60,
      include: { payment: { select: { id: true, providerReference: true, userId: true } } },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { actor: { select: { email: true } } },
    }),
  ]);

  return (
    <div>
      <PageHeading variant="dashboard">Legal control panel</PageHeading>
      <p className="mt-2 text-sm text-zinc-400">
        Centralized legal audit controls for agreements, contract acceptance, risk acknowledgements, payment verification,
        disputes, and user risk tagging.
      </p>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Policy versioning</h2>
          <form action={createPolicyVersion} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input name="policyKey" placeholder="Policy key, e.g. CHECKOUT_AGREEMENT" className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white" required />
            <input name="version" placeholder="Version, e.g. v1.1" className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white" required />
            <input name="title" placeholder="Optional title" className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white sm:col-span-2" />
            <textarea
              name="content"
              rows={4}
              placeholder="Policy body snapshot (optional)"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white sm:col-span-2"
            />
            <label className="flex items-center gap-2 text-xs text-zinc-300 sm:col-span-2">
              <input type="checkbox" name="isActive" defaultChecked />
              Set as active
            </label>
            <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black sm:col-span-2">
              Save policy version
            </button>
          </form>
          <div className="mt-4 max-h-52 space-y-2 overflow-auto text-xs text-zinc-400">
            {policyVersions.map((p) => (
              <p key={p.id}>
                {p.policyKey} · {p.version} · {p.isActive ? "active" : "inactive"}
              </p>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Contract system</h2>
          <p className="mt-2 text-xs text-zinc-500">Versioned legal contracts for sourcing workflows.</p>
          <form action={createContractVersion} className="mt-4 grid gap-3">
            <input name="type" placeholder="Contract type, e.g. CAR_SOURCING" className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white" required />
            <input name="version" placeholder="Version, e.g. v1.0" className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white" required />
            <textarea name="content" rows={4} placeholder="Contract text" className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white" required />
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input type="checkbox" name="isActive" defaultChecked />
              Set as active
            </label>
            <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black">
              Save contract
            </button>
          </form>
          <div className="mt-4 max-h-52 space-y-2 overflow-auto text-xs text-zinc-400">
            {contractTemplates.map((c) => (
              <p key={c.id}>
                {c.type} · {c.version} · {c.isActive ? "active" : "inactive"}
              </p>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">User risk tags</h2>
          <form action={createUserRiskTag} className="mt-4 grid gap-3 sm:grid-cols-2">
            <select name="userId" className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white sm:col-span-2" required>
              <option value="">Select user</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>
            <input name="tag" placeholder="Tag, e.g. HIGH_RISK" className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white sm:col-span-2" required />
            <textarea name="note" rows={3} placeholder="Optional note" className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white sm:col-span-2" />
            <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black sm:col-span-2">
              Add risk tag
            </button>
          </form>
          <div className="mt-4 max-h-56 space-y-2 overflow-auto text-xs text-zinc-400">
            {riskTags.map((tag) => (
              <div key={tag.id} className="flex items-center justify-between rounded-lg border border-white/10 p-2">
                <p>
                  {tag.user.email} · {tag.tag} · {tag.isActive ? "active" : "resolved"}
                </p>
                {tag.isActive ? (
                  <form action={resolveUserRiskTag}>
                    <input type="hidden" name="riskTagId" value={tag.id} />
                    <button type="submit" className="text-[var(--brand)] hover:underline">
                      Resolve
                    </button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Payment legal controls</h2>
          <p className="mt-2 text-xs text-zinc-500">Flag disputes and optionally change payment status.</p>
          <form action={updatePaymentLegalControl} className="mt-4 grid gap-3">
            <input name="paymentId" placeholder="Payment ID (cuid)" className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white" required />
            <select name="toStatus" className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white">
              <option value="">Keep current status</option>
              <option value="PENDING">PENDING</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="AWAITING_PROOF">AWAITING_PROOF</option>
              <option value="FAILED">FAILED</option>
              <option value="SUCCESS">SUCCESS</option>
            </select>
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input type="checkbox" name="disputed" />
              Flag as disputed
            </label>
            <textarea
              name="disputeReason"
              rows={3}
              placeholder="Dispute reason or legal note"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
            <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black">
              Apply payment legal control
            </button>
          </form>
          <div className="mt-4 max-h-56 space-y-2 overflow-auto text-xs text-zinc-400">
            {verifications.map((v) => (
              <p key={v.id}>
                {v.payment.providerReference ?? v.payment.id.slice(0, 10)} · verified {v.verified ? "yes" : "no"} · dispute{" "}
                {v.disputed ? "yes" : "no"}
              </p>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Legal acceptance logs</h2>
          <p className="mt-2 text-xs text-zinc-500">Agreement, sourcing contract, and risk confirmation audit records.</p>
          <div className="mt-4 max-h-72 space-y-2 overflow-auto text-xs text-zinc-400">
            {agreementLogs.slice(0, 20).map((r) => (
              <p key={r.id}>
                Agreement · {r.user?.email ?? "user"} · {r.order?.reference ?? "order"} · {r.agreementVersion}
              </p>
            ))}
            {contracts.slice(0, 20).map((r) => (
              <p key={r.id}>
                Contract · {r.user?.email ?? "user"} · {r.order?.reference ?? "order"} · {r.contractVersion}
              </p>
            ))}
            {risks.slice(0, 20).map((r) => (
              <p key={r.id}>
                Risk · {r.user?.email ?? "user"} · {r.order?.reference ?? "order"} · {r.context} · {r.acknowledgementVersion}
              </p>
            ))}
          </div>
          <div className="mt-4 flex gap-3 text-xs">
            <Link href="/admin/payments" className="text-[var(--brand)] hover:underline">
              Open payments
            </Link>
            <Link href="/admin/orders" className="text-[var(--brand)] hover:underline">
              Open orders
            </Link>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Wallet transactions</h2>
          <p className="mt-2 text-xs text-zinc-500">Top-ups, debits, and references with status tracking.</p>
          <div className="mt-4 max-h-72 space-y-2 overflow-auto text-xs text-zinc-400">
            {walletTxns.map((txn) => (
              <p key={txn.id}>
                {txn.user?.email ?? "user"} · {txn.direction} · {Number(txn.amount).toLocaleString()} {txn.currency} ·{" "}
                {txn.purpose} · {txn.status} · {txn.order?.reference ?? txn.reference}
              </p>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Risk events and disputes</h2>
          <p className="mt-2 text-xs text-zinc-500">Detected behavior risks and escalated disputes.</p>
          <div className="mt-4 max-h-72 space-y-2 overflow-auto text-xs text-zinc-400">
            {riskEvents.map((evt) => (
              <p key={evt.id}>
                Risk · {evt.user?.email ?? "user"} · {evt.severity} · {evt.type}
              </p>
            ))}
            {disputes.map((d) => (
              <p key={d.id}>
                Dispute · {d.payment.providerReference ?? d.payment.id.slice(0, 10)} · {d.disputeReason ?? "No reason"}
              </p>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-white">Audit activity</h2>
        <p className="mt-2 text-xs text-zinc-500">Admin actions, payment changes, and order updates.</p>
        <div className="mt-4 max-h-72 space-y-2 overflow-auto text-xs text-zinc-400">
          {auditLogs.map((log) => (
            <p key={log.id}>
              {log.actor?.email ?? "system"} · {log.action} · {log.entityType} · {log.entityId ?? "n/a"}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}

