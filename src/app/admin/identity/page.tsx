import { GhanaCardVerificationStatus, VerificationDocumentType, VerificationStatus } from "@prisma/client";
import { redirect } from "next/navigation";

import { AdminVerificationsHub } from "@/components/admin/admin-verifications-hub";
import { GhanaCardReviewTable } from "@/components/admin/ghana-card-review-table";
import { PageHeading } from "@/components/typography/page-headings";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { buildListPageMeta, listPageNav, readListPage, readSearchParam } from "@/lib/list-page";
import { prisma } from "@/lib/prisma";
import { isAdminRole, isSupportStaffRole } from "@/lib/roles";
import { safeAuth } from "@/lib/safe-auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const GHANA_PAGE_SIZE = 20;
const DOCS_PAGE_SIZE = 20;
const AUDIT_PAGE_SIZE = 20;

function readTab(sp: Record<string, string | string[] | undefined>): "ghana-card" | "documents" {
  const raw = typeof sp.tab === "string" ? sp.tab : Array.isArray(sp.tab) ? sp.tab[0] : undefined;
  if (raw === "documents" || raw === "verifications") return "documents";
  return "ghana-card";
}

export default async function AdminIdentityHubPage(props: { searchParams: SearchParams }) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=" + encodeURIComponent("/admin/identity"));
  }
  if (!session.user.role || (!isAdminRole(session.user.role) && !isSupportStaffRole(session.user.role))) {
    redirect("/admin");
  }

  const sp = await props.searchParams;
  const tab = readTab(sp);

  if (tab === "ghana-card") {
    await prisma.user.updateMany({
      where: {
        ghanaCardVerificationStatus: GhanaCardVerificationStatus.APPROVED,
        ghanaCardExpiresAt: { lt: new Date() },
      },
      data: { ghanaCardVerificationStatus: GhanaCardVerificationStatus.EXPIRED },
    });

    const pendingPageReq = readListPage(sp, "pendingPage");
    const expiredPageReq = readListPage(sp, "expiredPage");

    const [pendingTotal, expiredTotal] = await Promise.all([
      prisma.user.count({ where: { ghanaCardVerificationStatus: GhanaCardVerificationStatus.PENDING_REVIEW } }),
      prisma.user.count({ where: { ghanaCardVerificationStatus: GhanaCardVerificationStatus.EXPIRED } }),
    ]);
    const pendingMeta = buildListPageMeta(pendingTotal, GHANA_PAGE_SIZE, pendingPageReq);
    const expiredMeta = buildListPageMeta(expiredTotal, GHANA_PAGE_SIZE, expiredPageReq);
    const pendingNav = listPageNav("/admin/identity", { ...sp, tab: "ghana-card" }, pendingMeta, "pendingPage");
    const expiredNav = listPageNav("/admin/identity", { ...sp, tab: "ghana-card" }, expiredMeta, "expiredPage");

    const [pendingRows, expiredRows] = await Promise.all([
      prisma.user.findMany({
        where: { ghanaCardVerificationStatus: GhanaCardVerificationStatus.PENDING_REVIEW },
        orderBy: { updatedAt: "desc" },
        skip: pendingMeta.skip,
        take: GHANA_PAGE_SIZE,
        select: {
          id: true,
          email: true,
          name: true,
          ghanaCardPendingImageUrl: true,
          ghanaCardPendingIdNumber: true,
          ghanaCardAiSuggestedNumber: true,
          ghanaCardPendingExpiresAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.findMany({
        where: { ghanaCardVerificationStatus: GhanaCardVerificationStatus.EXPIRED },
        orderBy: { ghanaCardExpiresAt: "asc" },
        skip: expiredMeta.skip,
        take: GHANA_PAGE_SIZE,
        select: {
          id: true,
          email: true,
          name: true,
          ghanaCardIdNumber: true,
          ghanaCardExpiresAt: true,
          ghanaCardImageUrl: true,
        },
      }),
    ]);

    return (
      <div>
        <PageHeading variant="dashboard">Ghana Card review</PageHeading>
        <p className="mt-2 text-sm text-muted-foreground">
          Pending uploads stay temporary until approval. Expired IDs are listed for admin reset.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-3 py-1 text-amber-100">
            Pending: {pendingTotal}
          </span>
          <span className="rounded-full border border-red-300/30 bg-red-500/10 px-3 py-1 text-red-100">
            Expired: {expiredTotal}
          </span>
        </div>
        <div className="mt-8">
          <GhanaCardReviewTable
            pendingRows={pendingRows.map((r) => ({
              id: r.id,
              email: r.email,
              name: r.name,
              ghanaCardImageUrl: r.ghanaCardPendingImageUrl,
              ghanaCardPendingIdNumber: r.ghanaCardPendingIdNumber,
              ghanaCardAiSuggestedNumber: r.ghanaCardAiSuggestedNumber,
              ghanaCardPendingExpiresAt: r.ghanaCardPendingExpiresAt,
              updatedAt: r.updatedAt,
            }))}
            expiredRows={expiredRows.map((r) => ({
              id: r.id,
              email: r.email,
              name: r.name,
              ghanaCardIdNumber: r.ghanaCardIdNumber,
              ghanaCardExpiresAt: r.ghanaCardExpiresAt,
              ghanaCardImageUrl: r.ghanaCardImageUrl,
            }))}
          />
        </div>
        {pendingTotal > 0 ? (
          <ListPaginationFooter
            {...pendingNav}
            page={pendingMeta.page}
            totalPages={pendingMeta.totalPages}
            totalItems={pendingTotal}
            pageSize={GHANA_PAGE_SIZE}
            itemLabel="Pending Ghana Card"
            showPerPageNote
          />
        ) : null}
        {expiredTotal > 0 ? (
          <ListPaginationFooter
            {...expiredNav}
            page={expiredMeta.page}
            totalPages={expiredMeta.totalPages}
            totalItems={expiredTotal}
            pageSize={GHANA_PAGE_SIZE}
            itemLabel="Expired Ghana Card"
            showPerPageNote
          />
        ) : null}
      </div>
    );
  }

  const status = Object.values(VerificationStatus).includes(sp.status as VerificationStatus)
    ? (sp.status as VerificationStatus)
    : undefined;
  const documentType = Object.values(VerificationDocumentType).includes(sp.documentType as VerificationDocumentType)
    ? (sp.documentType as VerificationDocumentType)
    : undefined;
  const q = readSearchParam(sp, "q");
  const pageReq = readListPage(sp, "page");
  const auditPageReq = readListPage(sp, "auditPage");

  const where = {
    ...(status ? { status } : {}),
    ...(documentType ? { documentType } : {}),
    ...(q
      ? {
          OR: [
            { user: { email: { contains: q, mode: "insensitive" as const } } },
            { user: { name: { contains: q, mode: "insensitive" as const } } },
            { reason: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, auditTotal] = await Promise.all([
    prisma.userVerification.count({ where }),
    prisma.verificationAuditLog.count(),
  ]);
  const meta = buildListPageMeta(total, DOCS_PAGE_SIZE, pageReq);
  const auditMeta = buildListPageMeta(auditTotal, AUDIT_PAGE_SIZE, auditPageReq);
  const nav = listPageNav("/admin/identity", { ...sp, tab: "documents" }, meta);
  const auditNav = listPageNav("/admin/identity", { ...sp, tab: "documents" }, auditMeta, "auditPage");

  const [rows, recentAudit] = await Promise.all([
    prisma.userVerification.findMany({
      where,
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      skip: meta.skip,
      take: DOCS_PAGE_SIZE,
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    }),
    prisma.verificationAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: auditMeta.skip,
      take: AUDIT_PAGE_SIZE,
      select: {
        id: true,
        action: true,
        createdAt: true,
        user: { select: { email: true } },
        actor: { select: { email: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <PageHeading variant="dashboard">Document verification</PageHeading>
        <p className="mt-2 text-sm text-zinc-400">
          Review ID document submissions used for payments, sourcing, disputes, and fraud controls.
        </p>
      </div>
      <form
        method="get"
        action="/admin/identity"
        className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-4"
      >
        <input type="hidden" name="tab" value="documents" />
        <input
          name="q"
          defaultValue={q}
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
        <button
          type="submit"
          className="h-10 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black sm:col-span-4 sm:w-fit"
        >
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
          user: row.user,
        }))}
      />
      <ListPaginationFooter
        {...nav}
        page={meta.page}
        totalPages={meta.totalPages}
        totalItems={total}
        pageSize={DOCS_PAGE_SIZE}
        itemLabel="Verifications"
        showPerPageNote
      />
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm font-medium text-white">Recent verification audit</p>
        <ul className="mt-3 space-y-2 text-xs text-zinc-400">
          {recentAudit.length === 0 ? <li>No audit events yet.</li> : null}
          {recentAudit.map((a) => (
            <li key={a.id}>
              {a.createdAt.toISOString().slice(0, 19).replace("T", " ")} · {a.action} · {a.user.email}
              {a.actor?.email ? ` · by ${a.actor.email}` : ""}
            </li>
          ))}
        </ul>
        <ListPaginationFooter
          {...auditNav}
          page={auditMeta.page}
          totalPages={auditMeta.totalPages}
          totalItems={auditTotal}
          pageSize={AUDIT_PAGE_SIZE}
          itemLabel="Audit events"
          showPerPageNote
        />
      </div>
    </div>
  );
}
