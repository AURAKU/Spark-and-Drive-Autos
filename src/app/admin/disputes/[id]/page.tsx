import Link from "next/link";
import { DisputeCaseStatus, DisputeEvidenceType, DisputePriority, PaymentStatus } from "@prisma/client";
import { notFound } from "next/navigation";

import {
  addDisputeEvidenceAction,
  applyDisputeRiskTagAction,
  assignDisputeAction,
  collectDisputeEvidenceAction,
  resolveDisputePaymentAction,
  updateDisputePriorityAction,
  updateDisputeStatusAction,
} from "@/actions/disputes-admin";
import { PageHeading } from "@/components/typography/page-headings";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function AdminDisputeDetailPage(props: { params: Params }) {
  await requireAdmin();
  const { id } = await props.params;
  const dispute = await prisma.disputeCase.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, name: true } },
      payment: { select: { id: true, providerReference: true, status: true, amount: true, currency: true, createdAt: true } },
      order: { select: { id: true, reference: true, orderStatus: true } },
      receipt: { select: { id: true, receiptNumber: true, pdfUrl: true, issuedAt: true, status: true } },
      sourcingRequest: { select: { id: true, brand: true, model: true, status: true } },
      partsFinderSession: { select: { id: true, sessionId: true, status: true, createdAt: true } },
      assignedTo: { select: { id: true, email: true } },
      evidence: { include: { addedBy: { select: { email: true } } }, orderBy: { createdAt: "desc" }, take: 120 },
      timeline: { include: { actor: { select: { email: true } } }, orderBy: { createdAt: "desc" }, take: 150 },
    },
  });
  if (!dispute) return notFound();
  const [admins, riskTags, legalAcceptances, contractAcceptances, verification] = await Promise.all([
    prisma.user.findMany({
      where: { role: { not: "CUSTOMER" } },
      orderBy: { email: "asc" },
      select: { id: true, email: true },
      take: 80,
    }),
    dispute.userId
      ? prisma.userRiskTag.findMany({
          where: { userId: dispute.userId, isActive: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : [],
    dispute.userId
      ? prisma.userPolicyAcceptance.findMany({
          where: { userId: dispute.userId },
          orderBy: { acceptedAt: "desc" },
          take: 12,
          include: { policyVersion: { select: { policyKey: true, version: true } } },
        })
      : [],
    dispute.userId
      ? prisma.contractAcceptance.findMany({
          where: { userId: dispute.userId },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : [],
    dispute.userId
      ? prisma.userVerification.findFirst({
          where: { userId: dispute.userId },
          orderBy: { submittedAt: "desc" },
          select: { id: true, status: true, documentType: true, reviewedAt: true, reviewedById: true },
        })
      : null,
  ]);

  const evidenceChecklist = [
    "PAYMENT_VERIFICATION",
    "RECEIPT",
    "POLICY_ACCEPTANCE",
    "CONTRACT_ACCEPTANCE",
    "IDENTITY_VERIFICATION",
    "ORDER_RECORD",
    "DELIVERY_RECORD",
    "ADMIN_NOTE",
    "PROVIDER_RESPONSE",
  ] as const;
  const evidenceSet = new Set(dispute.evidence.map((e) => e.evidenceType));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <PageHeading variant="dashboard">Dispute case {dispute.caseNumber}</PageHeading>
          <p className="mt-2 text-sm text-zinc-400">
            Status {dispute.status} · Priority {dispute.priority} · Opened {dispute.openedAt.toISOString().slice(0, 16).replace("T", " ")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/disputes" className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white hover:bg-white/10">
            Back to disputes
          </Link>
          <Link href={`/api/admin/disputes/${dispute.id}/export`} className="rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-semibold text-black">
            Export packet
          </Link>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <Panel title="Case summary">
          <p className="text-sm text-zinc-300">{dispute.reason}</p>
          <p className="mt-3 text-xs text-zinc-400">{dispute.customerClaim ?? "No customer claim attached yet."}</p>
          <p className="mt-2 text-xs text-zinc-400">{dispute.adminSummary ?? "No admin summary yet."}</p>
        </Panel>
        <Panel title="Customer profile">
          <p className="text-sm text-white">{dispute.user?.email ?? "No linked user"}</p>
          <p className="text-xs text-zinc-400">Name: {dispute.user?.name ?? "-"}</p>
          <p className="text-xs text-zinc-400">Active risk tags: {riskTags.length}</p>
          <ul className="mt-2 space-y-1 text-xs text-zinc-300">
            {riskTags.map((tag) => (
              <li key={tag.id}>
                {tag.tag} ({tag.severity})
              </li>
            ))}
            {riskTags.length === 0 ? <li>No active risk tags.</li> : null}
          </ul>
        </Panel>
        <Panel title="Linked records">
          <ul className="space-y-1 text-xs text-zinc-300">
            <li>Payment: {dispute.payment ? `${dispute.payment.providerReference ?? dispute.payment.id} (${dispute.payment.status})` : "-"}</li>
            <li>Order: {dispute.order ? `${dispute.order.reference} (${dispute.order.orderStatus})` : "-"}</li>
            <li>Receipt: {dispute.receipt ? `${dispute.receipt.receiptNumber} (${dispute.receipt.status})` : "-"}</li>
            <li>Sourcing: {dispute.sourcingRequest ? `${dispute.sourcingRequest.brand} ${dispute.sourcingRequest.model}` : "-"}</li>
            <li>Parts Finder: {dispute.partsFinderSession ? dispute.partsFinderSession.sessionId : "-"}</li>
          </ul>
          {dispute.receipt?.pdfUrl ? (
            <a href={dispute.receipt.pdfUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/10">
              Download receipt PDF
            </a>
          ) : null}
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Controls">
          <form action={collectDisputeEvidenceAction} className="mb-3">
            <input type="hidden" name="disputeId" value={dispute.id} />
            <button type="submit" className="h-10 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black">
              Collect evidence
            </button>
          </form>
          <form action={updateDisputeStatusAction} className="grid gap-2 rounded-lg border border-white/10 p-3">
            <input type="hidden" name="disputeId" value={dispute.id} />
            <label className="text-xs text-zinc-400">Status</label>
            <select name="status" defaultValue={dispute.status} className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white">
              {Object.values(DisputeCaseStatus).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <textarea name="note" placeholder="Status note (required when resolving/refunding)" className="min-h-20 rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white" />
            <button className="h-9 rounded-lg border border-white/10 text-xs text-white hover:bg-white/10">Update status</button>
          </form>
          <form action={updateDisputePriorityAction} className="mt-3 grid gap-2 rounded-lg border border-white/10 p-3">
            <input type="hidden" name="disputeId" value={dispute.id} />
            <label className="text-xs text-zinc-400">Priority</label>
            <select
              name="priority"
              defaultValue={dispute.priority}
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
            >
              {Object.values(DisputePriority).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <button className="h-9 rounded-lg border border-white/10 text-xs text-white hover:bg-white/10">Update priority</button>
          </form>
          <form action={assignDisputeAction} className="mt-3 grid gap-2 rounded-lg border border-white/10 p-3">
            <input type="hidden" name="disputeId" value={dispute.id} />
            <label className="text-xs text-zinc-400">Assign admin</label>
            <select
              name="assignedToId"
              defaultValue={dispute.assignedToId ?? ""}
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
            >
              <option value="">Unassigned</option>
              {admins.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.email}
                </option>
              ))}
            </select>
            <button className="h-9 rounded-lg border border-white/10 text-xs text-white hover:bg-white/10">Save assignment</button>
          </form>
        </Panel>

        <Panel title="Payment resolution panel">
          <form action={resolveDisputePaymentAction} className="grid gap-2 rounded-lg border border-white/10 p-3">
            <input type="hidden" name="disputeId" value={dispute.id} />
            <input type="hidden" name="paymentId" value={dispute.paymentId ?? ""} />
            <label className="text-xs text-zinc-400">Payment status decision</label>
            <select
              name="paymentStatus"
              defaultValue={dispute.payment?.status ?? PaymentStatus.DISPUTED}
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
              disabled={!dispute.paymentId}
            >
              {[PaymentStatus.SUCCESS, PaymentStatus.REFUNDED, PaymentStatus.REVERSED, PaymentStatus.FAILED, PaymentStatus.DISPUTED].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <textarea
              required
              name="resolution"
              placeholder="Resolution note (required)"
              className="min-h-24 rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white"
              disabled={!dispute.paymentId}
            />
            <button disabled={!dispute.paymentId} className="h-9 rounded-lg border border-white/10 text-xs text-white hover:bg-white/10 disabled:opacity-50">
              Apply payment resolution
            </button>
          </form>
          <p className="mt-3 text-xs text-zinc-400">
            Original receipts are retained; if payment is reversed/refunded your existing receipt system keeps historical records for legal defense.
          </p>
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Evidence checklist">
          <ul className="space-y-1 text-xs text-zinc-300">
            {evidenceChecklist.map((item) => (
              <li key={item}>{evidenceSet.has(item) ? "✓" : "•"} {item}</li>
            ))}
          </ul>
          <form action={addDisputeEvidenceAction} className="mt-4 grid gap-2 rounded-lg border border-white/10 p-3">
            <input type="hidden" name="disputeId" value={dispute.id} />
            <select name="evidenceType" className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white">
              {Object.values(DisputeEvidenceType).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <input required name="title" placeholder="Evidence title" className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white" />
            <input name="fileUrl" placeholder="File URL (optional)" className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white" />
            <textarea name="description" placeholder="Evidence notes" className="min-h-20 rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white" />
            <button className="h-9 rounded-lg border border-white/10 text-xs text-white hover:bg-white/10">Add evidence</button>
          </form>
          <ul className="mt-3 space-y-2 text-xs text-zinc-300">
            {dispute.evidence.slice(0, 12).map((e) => (
              <li key={e.id} className="rounded-lg border border-white/10 p-2">
                <p className="font-medium text-white">{e.evidenceType} · {e.title}</p>
                <p>{e.description ?? "-"}</p>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Risk, legal and identity evidence">
          <form action={applyDisputeRiskTagAction} className="grid gap-2 rounded-lg border border-white/10 p-3">
            <input type="hidden" name="disputeId" value={dispute.id} />
            <input type="hidden" name="userId" value={dispute.userId ?? ""} />
            <select name="tag" className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white" disabled={!dispute.userId}>
              <option value="DISPUTE_HISTORY">DISPUTE_HISTORY</option>
              <option value="PAYMENT_VERIFICATION_REQUIRED">PAYMENT_VERIFICATION_REQUIRED</option>
              <option value="MANUAL_REVIEW_REQUIRED">MANUAL_REVIEW_REQUIRED</option>
              <option value="REFUND_REVIEW_REQUIRED">REFUND_REVIEW_REQUIRED</option>
              <option value="FRAUD_RISK_REVIEW">FRAUD_RISK_REVIEW</option>
            </select>
            <textarea name="note" placeholder="Risk-tag note" className="min-h-20 rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white" />
            <button disabled={!dispute.userId} className="h-9 rounded-lg border border-white/10 text-xs text-white hover:bg-white/10 disabled:opacity-50">
              Apply risk tag
            </button>
          </form>
          <div className="mt-3 rounded-lg border border-white/10 p-3">
            <p className="text-xs font-semibold text-white">Identity verification</p>
            <p className="mt-1 text-xs text-zinc-300">
              Status: {verification?.status ?? "No verification"} · Type: {verification?.documentType ?? "-"}
            </p>
            <p className="text-xs text-zinc-400">Reviewed at: {verification?.reviewedAt?.toISOString().slice(0, 16).replace("T", " ") ?? "-"}</p>
          </div>
          <div className="mt-3 rounded-lg border border-white/10 p-3">
            <p className="text-xs font-semibold text-white">Legal acceptance records</p>
            <ul className="mt-2 space-y-1 text-xs text-zinc-300">
              {legalAcceptances.map((a) => (
                <li key={a.id}>
                  {a.policyVersion.policyKey} v{a.policyVersion.version} · {a.acceptedAt.toISOString().slice(0, 16).replace("T", " ")}
                </li>
              ))}
              {legalAcceptances.length === 0 ? <li>No policy acceptance records.</li> : null}
            </ul>
          </div>
          <div className="mt-3 rounded-lg border border-white/10 p-3">
            <p className="text-xs font-semibold text-white">Contract acceptance records</p>
            <ul className="mt-2 space-y-1 text-xs text-zinc-300">
              {contractAcceptances.map((a) => (
                <li key={a.id}>
                  {a.contractVersion} ({a.context}) · {a.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </li>
              ))}
              {contractAcceptances.length === 0 ? <li>No contract acceptance records.</li> : null}
            </ul>
          </div>
        </Panel>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="text-sm font-semibold text-white">Timeline</h2>
        <ul className="mt-3 space-y-2 text-xs text-zinc-300">
          {dispute.timeline.map((e) => (
            <li key={e.id} className="rounded-lg border border-white/10 p-2">
              <p className="font-medium text-white">{e.action}</p>
              <p>
                {e.oldStatus ? `${e.oldStatus} → ` : ""}
                {e.newStatus ?? "-"} · {e.createdAt.toISOString().slice(0, 16).replace("T", " ")} {e.actor?.email ? `· ${e.actor.email}` : ""}
              </p>
              {e.note ? <p className="text-zinc-400">{e.note}</p> : null}
            </li>
          ))}
          {dispute.timeline.length === 0 ? <li>No events yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
