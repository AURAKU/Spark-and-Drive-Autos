import { VerificationDocumentType, VerificationStatus } from "@prisma/client";

import { AdminVerificationsHub } from "@/components/admin/admin-verifications-hub";
import { PageHeading } from "@/components/typography/page-headings";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string;
  documentType?: string;
  q?: string;
}>;

export default async function AdminVerificationsPage(props: { searchParams: SearchParams }) {
  await requireAdmin();
  const sp = await props.searchParams;
  const status = Object.values(VerificationStatus).includes(sp.status as VerificationStatus)
    ? (sp.status as VerificationStatus)
    : undefined;
  const documentType = Object.values(VerificationDocumentType).includes(sp.documentType as VerificationDocumentType)
    ? (sp.documentType as VerificationDocumentType)
    : undefined;
  const q = sp.q?.trim();

  const rows = await prisma.userVerification.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(documentType ? { documentType } : {}),
      ...(q
        ? {
            OR: [
              { user: { email: { contains: q, mode: "insensitive" } } },
              { user: { name: { contains: q, mode: "insensitive" } } },
              { reason: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    take: 120,
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });
  const recentAudit = await prisma.verificationAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      action: true,
      createdAt: true,
      user: { select: { email: true } },
      actor: { select: { email: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <PageHeading variant="dashboard">Identity verifications</PageHeading>
        <p className="mt-2 text-sm text-zinc-400">
          Review Ghana Card/ID submissions for risk-based payment, sourcing, dispute, and fraud controls.
        </p>
      </div>
      <form className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-4">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search user or reason"
          className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white sm:col-span-2"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
        >
          <option value="">All statuses</option>
          {Object.values(VerificationStatus).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          name="documentType"
          defaultValue={documentType ?? ""}
          className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
        >
          <option value="">All document types</option>
          {Object.values(VerificationDocumentType).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="submit" className="h-10 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black sm:col-span-4 sm:w-fit">
          Apply filters
        </button>
      </form>
      <AdminVerificationsHub
        rows={rows.map((row) => ({
          id: row.id,
          userId: row.userId,
          status: row.status,
          documentType: row.documentType,
          reason: row.reason,
          rejectionReason: row.rejectionReason,
          submittedAt: row.submittedAt.toISOString(),
          reviewedAt: row.reviewedAt?.toISOString() ?? null,
          user: {
            email: row.user.email,
            name: row.user.name,
          },
        }))}
      />
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="text-sm font-semibold text-white">Verification audit log</h2>
        <ul className="mt-3 space-y-1.5 text-xs text-zinc-400">
          {recentAudit.map((log) => (
            <li key={log.id}>
              {log.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {log.action} · user {log.user.email}
              {log.actor?.email ? ` · actor ${log.actor.email}` : ""}
            </li>
          ))}
          {recentAudit.length === 0 ? <li>No audit activity yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
