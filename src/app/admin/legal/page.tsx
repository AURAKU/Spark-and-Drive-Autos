import Link from "next/link";
import { redirect } from "next/navigation";

import {
  activateContractVersionAction,
  activatePolicyVersionAction,
  createContractVersion,
  createPolicyVersion,
  createUserRiskTag,
  resolveUserRiskTag,
  updatePaymentLegalControl,
} from "@/actions/legal-admin";
import { PageHeading } from "@/components/typography/page-headings";
import {
  DEFAULT_ADMIN_CONTRACT_TYPE,
  DEFAULT_ADMIN_POLICY_KEY,
  resolveContractFormTemplate,
  resolvePolicyFormTemplate,
} from "@/lib/legal-form-defaults";
import { DEFAULT_PAYMENT_DISPUTE_NOTE, POLICY_KEYS } from "@/lib/legal-enforcement";
import { isAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function spStr(sp: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = sp[key];
  return typeof v === "string" ? v : undefined;
}

function suggestNextVersion(version: string): string {
  const m = version.trim().match(/^v?(\d+)\.(\d+)$/i);
  if (!m) return version ? `${version}-next` : "v1.1";
  const major = Number(m[1] ?? 1);
  const minor = Number(m[2] ?? 0);
  return `v${major}.${minor + 1}`;
}

export default async function AdminLegalPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await safeAuth();
  if (!session?.user?.id || !session.user.role || !isAdminRole(session.user.role)) {
    redirect("/admin");
  }

  const sp = await searchParams;
  const newPolicy = spStr(sp, "newPolicy") === "1";
  const newContract = spStr(sp, "newContract") === "1";
  const err = spStr(sp, "err");
  const saved = spStr(sp, "saved") === "1";
  const paymentSaved = spStr(sp, "paymentSaved") === "1";
  const activated = spStr(sp, "activated") === "1";
  const policyKeyParam = spStr(sp, "policyKey");
  const policyVersionIdParam = spStr(sp, "policyVersionId");
  const contractIdParam = spStr(sp, "contractId");
  const contractTypeParam = spStr(sp, "contractType");
  const paymentIdParam = spStr(sp, "paymentId");
  const riskTagIdParam = spStr(sp, "riskTagId");

  const policyDefaults = newPolicy
    ? {
        policyKey: policyKeyParam && policyKeyParam.trim() ? policyKeyParam : DEFAULT_ADMIN_POLICY_KEY,
        version: "",
        title: "",
        content: "",
        isActive: true,
        sourceId: null as string | null,
      }
    : (await resolvePolicyFormTemplate({ policyKey: policyKeyParam, policyVersionId: policyVersionIdParam })) ??
      (await resolvePolicyFormTemplate({ policyKey: policyKeyParam ?? DEFAULT_ADMIN_POLICY_KEY }))!;

  const contractDefaults = newContract
    ? {
        type: contractTypeParam && contractTypeParam.trim() ? contractTypeParam : DEFAULT_ADMIN_CONTRACT_TYPE,
        title: "",
        version: "",
        content: "",
        isActive: true,
        sourceId: null as string | null,
      }
    : (await resolveContractFormTemplate({ contractId: contractIdParam, contractType: contractTypeParam })) ??
      (await resolveContractFormTemplate({ contractType: contractTypeParam ?? DEFAULT_ADMIN_CONTRACT_TYPE }))!;

  const [paymentForForm, paymentVerificationRow, riskTagForForm] = await Promise.all([
    paymentIdParam
      ? prisma.payment.findUnique({
          where: { id: paymentIdParam },
          select: { id: true, status: true },
        })
      : null,
    paymentIdParam
      ? prisma.paymentVerification.findUnique({ where: { paymentId: paymentIdParam } })
      : null,
    riskTagIdParam
      ? prisma.userRiskTag.findUnique({
          where: { id: riskTagIdParam },
          select: { id: true, userId: true, tag: true, note: true, severity: true },
        })
      : null,
  ]);

  const [
    policyVersions,
    contractTemplates,
    agreementLogs,
    contracts,
    risks,
    verifications,
    users,
    riskTags,
    walletTxns,
    riskEvents,
    disputes,
    auditLogs,
    legalAuditLogs,
    paymentDisputeRows,
    recentPayments,
    policyAcceptances,
  ] = await Promise.all([
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
    prisma.legalAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        actor: { select: { email: true } },
        targetUser: { select: { email: true } },
      },
    }),
    prisma.paymentDispute.findMany({
      orderBy: { flaggedAt: "desc" },
      take: 50,
      include: {
        payment: { select: { id: true, providerReference: true, status: true } },
        flaggedBy: { select: { email: true } },
      },
    }),
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 150,
      select: { id: true, providerReference: true, status: true, amount: true, currency: true },
    }),
    prisma.userPolicyAcceptance.findMany({
      orderBy: { acceptedAt: "desc" },
      take: 60,
      include: {
        user: { select: { email: true } },
        policyVersion: { select: { policyKey: true, version: true } },
      },
    }),
  ]);

  const latestForCurrentPolicyKey = policyVersions.find((p) => p.policyKey === policyDefaults.policyKey);
  const policyNextVersionSuggestion = suggestNextVersion(latestForCurrentPolicyKey?.version ?? policyDefaults.version ?? "v1.0");

  return (
    <div>
      <PageHeading variant="dashboard">Legal control panel</PageHeading>
      <p className="mt-2 text-sm text-zinc-400">
        Centralized legal audit controls for agreements, contract acceptance, risk acknowledgements, payment verification,
        disputes, and user risk tagging. Forms load your last saved entry (or a row you select from history) so you can
        revise and publish a new version.
      </p>
      <p className="mt-2 text-xs text-zinc-400">
        Need case-level defense workflow?{" "}
        <Link href="/admin/disputes" className="text-[var(--brand)] hover:underline">
          Open Disputes & Chargebacks
        </Link>
      </p>

      {saved && policyVersionIdParam ? (
        <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          Policy version saved. You are viewing the new entry; change the <span className="font-medium">version</span>{" "}
          string before saving again (each key + version must be unique).
        </p>
      ) : null}
      {saved && contractIdParam && !policyVersionIdParam ? (
        <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          Contract version saved. You are viewing the new entry; update the <span className="font-medium">version</span>{" "}
          before publishing another revision.
        </p>
      ) : null}
      {paymentSaved ? (
        <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          Payment legal control applied. The form is pre-filled for follow-up.
        </p>
      ) : null}
      {err === "policy" || err === "contract" || err === "payment" ? (
        <p className="mt-4 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          That submission could not be saved. Check that every required field is valid and try again.
        </p>
      ) : null}
      {err === "policy_unique" ? (
        <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          A row already exists for this policy key and version. Open the latest entry, bump the version (e.g. v1.0 →
          v1.1), then save again.
        </p>
      ) : null}
      {err === "payment_evidence" ? (
        <p className="mt-4 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Marking a payment as SUCCESS requires verification evidence: either an approved payment proof or a verified
          verification record. Complete proof review first, then retry.
        </p>
      ) : null}
      {err === "activate" ? (
        <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          That activation request could not be completed. Refresh the page and select a valid history row.
        </p>
      ) : null}
      {activated ? (
        <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          Active version updated. Users may need to re-accept where your flows require the latest policy or contract text.
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Policy versioning</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Each save creates a new version row. The form is filled from the latest match for the policy key, or the
            exact row you open from the list. Use a new <span className="text-zinc-400">version</span> string each time.
          </p>
          <p className="mt-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Users will be required to re-accept this policy when a newer active version is published.
          </p>
          {policyDefaults.sourceId ? (
            <p className="mt-2 text-xs text-zinc-500">
              Template from saved row{" "}
              <code className="text-zinc-400">
                {policyDefaults.policyKey} / {policyDefaults.version}
              </code>
            </p>
          ) : null}
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
            <span className="text-zinc-500">Load latest for:</span>
            {(Object.keys(POLICY_KEYS) as Array<keyof typeof POLICY_KEYS>).map((k) => (
              <Link
                key={POLICY_KEYS[k]}
                href={`/admin/legal?policyKey=${encodeURIComponent(POLICY_KEYS[k])}`}
                className="text-[var(--brand)] hover:underline"
              >
                {POLICY_KEYS[k]}
              </Link>
            ))}
            <Link href="/admin/legal?newPolicy=1" className="text-zinc-400 hover:text-zinc-200">
              Blank
            </Link>
          </p>
          <form
            key={`policy-${policyVersionIdParam ?? "none"}-${policyKeyParam ?? "d"}-${newPolicy ? "new" : "ed"}`}
            action={createPolicyVersion}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <input
              name="policyKey"
              defaultValue={policyDefaults.policyKey}
              placeholder="Policy key, e.g. CHECKOUT_AGREEMENT"
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
              required
            />
            <input
              name="version"
              defaultValue={policyDefaults.version || policyNextVersionSuggestion}
              placeholder="Version, e.g. v1.1"
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
              required
            />
            <input
              name="title"
              defaultValue={policyDefaults.title}
              placeholder="Title (required)"
              required
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white sm:col-span-2"
            />
            <textarea
              name="content"
              defaultValue={policyDefaults.content}
              rows={6}
              placeholder="Policy body snapshot (required)"
              required
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white sm:col-span-2"
            />
            <label className="flex items-center gap-2 text-xs text-zinc-300 sm:col-span-2">
              <input type="checkbox" name="isActive" defaultChecked={policyDefaults.isActive} />
              Set as active
            </label>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black sm:col-span-2"
            >
              Save policy version
            </button>
          </form>
          <div className="mt-4 max-h-52 space-y-2 overflow-auto text-xs text-zinc-400">
            {policyVersions.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-1.5">
                <Link href={`/admin/legal?policyVersionId=${encodeURIComponent(p.id)}`} className="text-[var(--brand)] hover:underline">
                  {p.policyKey} · {p.version} · {p.isActive ? "active" : "inactive"}
                </Link>
                {!p.isActive ? (
                  <form action={activatePolicyVersionAction}>
                    <input type="hidden" name="policyVersionId" value={p.id} />
                    <button type="submit" className="text-emerald-400 hover:underline">
                      Activate
                    </button>
                  </form>
                ) : (
                  <span className="text-emerald-500/80">●</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Contract system</h2>
          <p className="mt-1 text-xs text-zinc-500">Versioned legal contracts for sourcing workflows (e.g. vehicle sourcing).</p>
          {contractDefaults.sourceId ? (
            <p className="mt-2 text-xs text-zinc-500">
              Template from{" "}
              <code className="text-zinc-400">
                {contractDefaults.type} / {contractDefaults.version}
              </code>
            </p>
          ) : null}
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
            <span>Load latest for</span>
            <Link
              href={`/admin/legal?contractType=${encodeURIComponent(DEFAULT_ADMIN_CONTRACT_TYPE)}`}
              className="text-[var(--brand)] hover:underline"
            >
              {DEFAULT_ADMIN_CONTRACT_TYPE}
            </Link>
            <Link href="/admin/legal?newContract=1" className="text-zinc-400 hover:text-zinc-200">
              Blank
            </Link>
          </p>
          <form
            key={`contract-${contractIdParam ?? "none"}-${contractTypeParam ?? "t"}-${newContract ? "new" : "ed"}`}
            action={createContractVersion}
            className="mt-4 grid gap-3"
          >
            <input
              name="type"
              defaultValue={contractDefaults.type}
              placeholder="Contract type, e.g. CAR_SOURCING"
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
              required
            />
            <input
              name="version"
              defaultValue={contractDefaults.version}
              placeholder="Version, e.g. v1.0"
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
              required
            />
            <textarea
              name="content"
              defaultValue={contractDefaults.content}
              rows={4}
              placeholder="Contract text"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              required
            />
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input type="checkbox" name="isActive" defaultChecked={contractDefaults.isActive} />
              Set as active
            </label>
            <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black">
              Save contract
            </button>
          </form>
          <div className="mt-4 max-h-52 space-y-2 overflow-auto text-xs text-zinc-400">
            {contractTemplates.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-1.5">
                <Link href={`/admin/legal?contractId=${encodeURIComponent(c.id)}`} className="text-[var(--brand)] hover:underline">
                  {c.type} · {c.version} · {c.isActive ? "active" : "inactive"}
                </Link>
                {!c.isActive ? (
                  <form action={activateContractVersionAction}>
                    <input type="hidden" name="contractId" value={c.id} />
                    <button type="submit" className="text-emerald-400 hover:underline">
                      Activate
                    </button>
                  </form>
                ) : (
                  <span className="text-emerald-500/80">●</span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">User risk tags</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Open a row from the list to pre-fill a new tag (or adjust and save a new entry).
            {riskTagForForm ? (
              <Link href="/admin/legal" className="ml-2 text-zinc-400 hover:text-zinc-200">
                Clear
              </Link>
            ) : null}
          </p>
          <form action={createUserRiskTag} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">User (searchable)</label>
              <input
                name="userId"
                list="legal-user-pick"
                defaultValue={riskTagForForm?.userId ?? ""}
                placeholder="Paste user id, type user email, or pick from list"
                className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
                required
                autoComplete="off"
              />
              <datalist id="legal-user-pick">
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))}
              </datalist>
            </div>
            <select
              name="tag"
              defaultValue={riskTagForForm?.tag ?? ""}
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white sm:col-span-2"
              required
            >
              <option value="">Select internal tag</option>
              <option value="MANUAL_REVIEW_REQUIRED">MANUAL_REVIEW_REQUIRED</option>
              <option value="PAYMENT_VERIFICATION_REQUIRED">PAYMENT_VERIFICATION_REQUIRED</option>
              <option value="DISPUTE_HISTORY">DISPUTE_HISTORY</option>
              <option value="HIGH_VALUE_TRANSACTION">HIGH_VALUE_TRANSACTION</option>
              <option value="FRAUD_RISK_REVIEW">FRAUD_RISK_REVIEW</option>
              <option value="REFUND_REVIEW_REQUIRED">REFUND_REVIEW_REQUIRED</option>
              <option value="SOURCING_RISK_REVIEW">SOURCING_RISK_REVIEW</option>
              <option value="ACCOUNT_SECURITY_REVIEW">ACCOUNT_SECURITY_REVIEW</option>
            </select>
            <select
              name="severity"
              defaultValue={riskTagForForm?.severity ?? "MEDIUM"}
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white sm:col-span-2"
              required
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
            <textarea
              name="note"
              defaultValue={riskTagForForm?.note ?? ""}
              rows={3}
              placeholder="Internal notes (operational, factual)"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white sm:col-span-2"
            />
            <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black sm:col-span-2">
              Add risk tag
            </button>
          </form>
          <div className="mt-4 max-h-56 space-y-2 overflow-auto text-xs text-zinc-400">
            {riskTags.map((tag) => (
              <div key={tag.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 p-2">
                <p>
                  <Link href={`/admin/legal?riskTagId=${encodeURIComponent(tag.id)}`} className="text-[var(--brand)] hover:underline">
                    {tag.user.email} · {tag.tag} · {tag.isActive ? "active" : "resolved"}
                  </Link>
                </p>
                {tag.isActive ? (
                  <form action={resolveUserRiskTag}>
                    <input type="hidden" name="riskTagId" value={tag.id} />
                    <button type="submit" className="shrink-0 text-[var(--brand)] hover:underline">
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
          <p className="mt-2 text-xs text-zinc-500">Flag disputes and optionally change payment status. Select a row below to reload this form.</p>
          <form action={updatePaymentLegalControl} className="mt-4 grid gap-3">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Payment (id or pick)</label>
              <input
                name="paymentId"
                list="legal-payment-pick"
                defaultValue={paymentIdParam ?? ""}
                placeholder="Payment ID (cuid)"
                className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
                required
                autoComplete="off"
              />
              <datalist id="legal-payment-pick">
                {recentPayments.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.providerReference ?? p.id.slice(0, 10)} · {p.status} · {Number(p.amount).toFixed(2)} {p.currency}
                  </option>
                ))}
              </datalist>
            </div>
            {paymentForForm ? (
              <p className="text-xs text-zinc-500">
                Current status: <span className="font-mono text-zinc-300">{paymentForForm.status}</span>
              </p>
            ) : null}
            <select
              name="toStatus"
              defaultValue={paymentForForm?.status ?? ""}
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
            >
              <option value="">Keep current status</option>
              <option value="PENDING">PENDING</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="AWAITING_PROOF">AWAITING_PROOF</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW</option>
              <option value="FAILED">FAILED</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="REFUNDED">REFUNDED</option>
              <option value="DISPUTED">DISPUTED</option>
              <option value="REVERSED">REVERSED</option>
            </select>
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input type="checkbox" name="disputed" defaultChecked={paymentVerificationRow?.disputed ?? false} />
              Flag as disputed (creates immutable dispute record)
            </label>
            <textarea
              name="disputeReason"
              defaultValue={paymentVerificationRow?.disputeReason ?? ""}
              rows={2}
              placeholder="Dispute reason (shown on verification row)"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
            <textarea
              name="evidenceNotes"
              rows={2}
              placeholder={`Evidence / internal notes (defaults to: ${DEFAULT_PAYMENT_DISPUTE_NOTE.slice(0, 72)}…)`}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            />
            <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black">
              Apply payment legal control
            </button>
          </form>
          <div className="mt-4 max-h-56 space-y-2 overflow-auto text-xs text-zinc-400">
            {verifications.map((v) => (
              <p key={v.id}>
                <Link
                  href={`/admin/legal?paymentId=${encodeURIComponent(v.payment.id)}`}
                  className="text-[var(--brand)] hover:underline"
                >
                  {v.payment.providerReference ?? v.payment.id.slice(0, 10)} · verified {v.verified ? "yes" : "no"} ·
                  dispute {v.disputed ? "yes" : "no"}
                </Link>
              </p>
            ))}
          </div>
          <div className="mt-4 max-h-48 space-y-1 overflow-auto border-t border-white/10 pt-3 text-xs text-zinc-500">
            <p className="font-medium text-zinc-400">Payment dispute register (append-only)</p>
            {paymentDisputeRows.map((d) => (
              <p key={d.id}>
                <Link href={`/admin/legal?paymentId=${encodeURIComponent(d.payment.id)}`} className="text-[var(--brand)] hover:underline">
                  {d.payment.providerReference ?? d.payment.id.slice(0, 10)}
                </Link>{" "}
                · {d.status} · {d.flaggedBy.email}
                {d.reason ? ` · ${d.reason.slice(0, 60)}${d.reason.length > 60 ? "…" : ""}` : ""}
              </p>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Legal acceptance logs</h2>
          <p className="mt-2 text-xs text-zinc-500">Agreement, sourcing contract, and risk confirmation audit records.</p>
          <div className="mt-4 max-h-72 space-y-2 overflow-auto text-xs text-zinc-400">
            {policyAcceptances.map((a) => (
              <p key={a.id}>
                Policy v{a.policyVersion.version} · {a.policyVersion.policyKey} · {a.context} · {a.user.email}
              </p>
            ))}
            {agreementLogs.slice(0, 20).map((r) => (
              <p key={r.id}>
                Checkout agreement log · {r.user?.email ?? "user"} · {r.order?.reference ?? "order"} · {r.agreementVersion}
              </p>
            ))}
            {contracts.slice(0, 20).map((r) => (
              <p key={r.id}>
                Contract · {r.user?.email ?? "user"} · {r.order?.reference ?? "order"} · {r.contractVersion}
              </p>
            ))}
            {risks.slice(0, 20).map((r) => (
              <p key={r.id}>
                Risk ack · {r.user?.email ?? "user"} · {r.order?.reference ?? "order"} · {r.context} · {r.acknowledgementVersion}
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
        <h2 className="text-lg font-semibold text-white">Legal audit trail</h2>
        <p className="mt-2 text-xs text-zinc-500">Policy, contract, consent, risk tags, and payment legal controls.</p>
        <div className="mt-4 max-h-72 space-y-2 overflow-auto text-xs text-zinc-400">
          {legalAuditLogs.map((log) => (
            <p key={log.id}>
              {log.actor?.email ?? "system"}
              {log.targetUser ? ` → ${log.targetUser.email}` : ""} · {log.action} · {log.entityType} ·{" "}
              {log.entityId ?? "n/a"}
            </p>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-white">General audit activity</h2>
        <p className="mt-2 text-xs text-zinc-500">Broader admin actions, payment transitions, and order updates.</p>
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

