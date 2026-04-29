import Link from "next/link";
import { redirect } from "next/navigation";
import { VerificationDocumentType, VerificationStatus } from "@prisma/client";

import { AdminVerificationsHub } from "@/components/admin/admin-verifications-hub";
import { AdminPartsFinderHubTabs, type AdminPartsFinderHubView } from "@/components/admin/admin-parts-finder-hub-tabs";
import { PartsFinderStatCard } from "@/components/parts-finder/parts-finder-stat-card";
import { PageHeading } from "@/components/typography/page-headings";
import { getPartsFinderAnalytics } from "@/lib/parts-finder/intelligence-analytics";
import { PARTS_FINDER_PRODUCT_NAME } from "@/lib/parts-finder/marketing-copy";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

import { isAdminRole } from "@/auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readView(sp: Record<string, string | string[] | undefined>): AdminPartsFinderHubView {
  const v = sp.view;
  const s = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  if (s === "verifications") return "verifications";
  if (s === "verified-parts") return "verified-parts";
  return "overview";
}

export default async function AdminPartsFinderOverviewPage(props: { searchParams: SearchParams }) {
  const session = await safeAuth();
  if (!session?.user?.role || !isAdminRole(session.user.role)) redirect("/dashboard");

  const sp = await props.searchParams;
  const view = readView(sp);

  if (view === "overview") {
    const [analytics, membershipPayments] = await Promise.all([
      getPartsFinderAnalytics(),
      prisma.payment.count({
        where: { paymentType: "PARTS_FINDER_MEMBERSHIP", status: "SUCCESS" },
      }),
    ]);

    return (
      <div>
        <AdminPartsFinderHubTabs active="overview" />
        <PageHeading variant="dashboard">{PARTS_FINDER_PRODUCT_NAME} · Admin</PageHeading>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage activation performance, review queue, and search telemetry for premium parts matching.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <PartsFinderStatCard label="Successful activations" value={membershipPayments} />
          <PartsFinderStatCard
            label="Operational load"
            value={analytics.totalSearches + analytics.membership.pendingSearchReviews}
            hint="Total searches plus sessions awaiting review."
          />
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          <Link href="/admin/parts-finder/analytics" className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/40">
            Analytics
          </Link>
          <Link href="/admin/parts-finder/settings" className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/40">
            Settings
          </Link>
          <Link href="/admin/parts-finder/memberships" className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/40">
            Memberships
          </Link>
          <Link href="/admin/parts-finder/searches" className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/40">
            Searches
          </Link>
        </div>
      </div>
    );
  }

  if (view === "verifications") {
    const status = Object.values(VerificationStatus).includes(sp.status as VerificationStatus)
      ? (sp.status as VerificationStatus)
      : undefined;
    const documentType = Object.values(VerificationDocumentType).includes(sp.documentType as VerificationDocumentType)
      ? (sp.documentType as VerificationDocumentType)
      : undefined;
    const q = typeof sp.q === "string" ? sp.q.trim() : undefined;

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
        <AdminPartsFinderHubTabs active="verifications" />
        <div>
          <PageHeading variant="dashboard">Identity verifications</PageHeading>
          <p className="mt-2 text-sm text-zinc-400">
            Review Ghana Card/ID submissions for risk-based payment, sourcing, dispute, and fraud controls.
          </p>
        </div>
        <form method="get" action="/admin/parts-finder" className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-4">
          <input type="hidden" name="view" value="verifications" />
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

  const verifiedRows = await prisma.verifiedPartRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      payment: { select: { status: true } },
      assignedAdmin: { select: { name: true, email: true } },
    },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <AdminPartsFinderHubTabs active="verified-parts" />
      <PageHeading variant="dashboard">Verified part requests</PageHeading>
      <p className="mt-2 text-sm text-muted-foreground">Review and fulfill premium verified parts workflows.</p>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="space-y-2">
          {verifiedRows.map((row) => (
            <Link
              key={row.id}
              href={`/admin/verified-parts/${row.id}`}
              className="flex items-center justify-between rounded-lg border border-border bg-background p-3 hover:bg-muted/30"
            >
              <div>
                <p className="text-sm font-semibold">{row.requestNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {row.user.name ?? row.user.email} · {row.partName}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium">{row.status.replaceAll("_", " ")}</p>
                <p className="text-[11px] text-muted-foreground">Payment: {row.payment?.status ?? "PENDING"}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
