import Link from "next/link";
import { redirect } from "next/navigation";

import {
  activateMembershipManually,
  extendMembership,
  suspendMembership,
} from "@/actions/parts-finder-admin";
import { PageHeading } from "@/components/typography/page-headings";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { PARTS_FINDER_PRODUCT_NAME } from "@/lib/parts-finder/marketing-copy";
import { normalizeIntelListPage } from "@/lib/ops";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

import { isAdminRole } from "@/auth";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 15;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readPage(sp: Record<string, string | string[] | undefined>, key: string): number {
  const v = sp[key];
  const s = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  if (s == null || s === "") return 1;
  const n = parseInt(s, 10);
  return normalizeIntelListPage(Number.isFinite(n) ? n : undefined);
}

export default async function AdminPartsFinderMembershipsPage(props: { searchParams: SearchParams }) {
  const session = await safeAuth();
  if (!session?.user?.role || !isAdminRole(session.user.role)) redirect("/dashboard");
  const sp = await props.searchParams;
  const opSuccess = typeof sp.success === "string" ? sp.success : "";
  const opError = typeof sp.error === "string" ? sp.error : "";
  const pageReq = readPage(sp, "page");
  const statusFilterRaw = typeof sp.status === "string" ? sp.status : "";
  const statusFilter =
    statusFilterRaw === "ACTIVE" || statusFilterRaw === "EXPIRED" || statusFilterRaw === "SUSPENDED"
      ? statusFilterRaw
      : "ALL";
  const now = new Date();
  const where =
    statusFilter === "ALL"
      ? {}
      : statusFilter === "ACTIVE"
        ? { status: "ACTIVE" as const, endsAt: { gt: now } }
        : statusFilter === "EXPIRED"
          ? { OR: [{ status: "EXPIRED" as const }, { status: "ACTIVE" as const, endsAt: { lte: now } }] }
          : { status: "SUSPENDED" as const };

  const [total, activeCount, expiredCount, suspendedCount, pendingSearchReviews] = await Promise.all([
    prisma.partsFinderMembership.count({ where }),
    prisma.partsFinderMembership.count({ where: { status: "ACTIVE", endsAt: { gt: now } } }),
    prisma.partsFinderMembership.count({ where: { OR: [{ status: "EXPIRED" }, { status: "ACTIVE", endsAt: { lte: now } }] } }),
    prisma.partsFinderMembership.count({ where: { status: "SUSPENDED" } }),
    prisma.partsFinderSearchSession.count({ where: { status: "PENDING_REVIEW" } }),
  ]);
  const [pendingPaymentCount, pendingApprovalCount] = await Promise.all([
    prisma.payment.groupBy({
      by: ["userId"],
      where: {
        paymentType: "PARTS_FINDER_MEMBERSHIP",
        status: { in: ["PENDING", "AWAITING_PROOF", "PROCESSING"] },
        userId: { not: null },
      },
    }).then((rows) => rows.length),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT p."userId")::bigint AS count
      FROM "Payment" p
      CROSS JOIN LATERAL (
        SELECT s."approvalMode"
        FROM "PartsFinderSettings" s
        ORDER BY s."updatedAt" DESC
        LIMIT 1
      ) cfg
      WHERE p."paymentType" = 'PARTS_FINDER_MEMBERSHIP'
        AND p."status" = 'SUCCESS'
        AND p."userId" IS NOT NULL
        AND cfg."approvalMode" = 'MANUAL'
        AND NOT EXISTS (
          SELECT 1
          FROM "PartsFinderMembership" m
          WHERE m."userId" = p."userId"
            AND m."status" = 'ACTIVE'
            AND m."endsAt" > NOW()
        )
    `.then((rows) => Number(rows[0]?.count ?? 0)),
  ]);
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / PAGE_SIZE));
  const page = Math.min(Math.max(1, pageReq), totalPages);
  const membershipOpAction = async (formData: FormData) => {
    "use server";
    const userId = String(formData.get("userId") ?? "").trim();
    const action = String(formData.get("action") ?? "").trim();
    const daysValue = String(formData.get("days") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim();
    const days = daysValue ? Number.parseInt(daysValue, 10) : undefined;
    const basePath = "/admin/parts-finder/memberships";
    if (!userId) {
      redirect(`${basePath}?error=${encodeURIComponent("Missing user id for membership operation.")}`);
    }
    if (daysValue && (!Number.isFinite(days) || (days ?? 0) < 1 || (days ?? 0) > 365)) {
      redirect(`${basePath}?error=${encodeURIComponent("Days must be between 1 and 365.")}`);
    }
    let result: { ok: true } | { error: string };
    if (action === "ACTIVATE") {
      result = await activateMembershipManually({ userId, days, reason: reason || undefined });
    } else if (action === "EXTEND") {
      if (!days) {
        redirect(`${basePath}?error=${encodeURIComponent("Extension requires days.")}`);
      }
      result = await extendMembership({ userId, days, reason: reason || undefined });
    } else if (action === "DEACTIVATE") {
      result = await suspendMembership({ userId, reason: reason || undefined });
    } else {
      redirect(`${basePath}?error=${encodeURIComponent("Unsupported membership action.")}`);
    }
    if ("error" in result) {
      redirect(`${basePath}?error=${encodeURIComponent(result.error)}`);
    }
    const message =
      action === "ACTIVATE"
        ? "Membership activated."
        : action === "EXTEND"
          ? "Membership extended."
          : "Membership suspended.";
    redirect(`${basePath}?success=${encodeURIComponent(message)}`);
  };
  const rows = await prisma.partsFinderMembership.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      status: true,
      startsAt: true,
      endsAt: true,
      reason: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });
  const pageHref = (nextPage: number) =>
    nextPage > 1
      ? `/admin/parts-finder/memberships?page=${nextPage}${statusFilter !== "ALL" ? `&status=${statusFilter}` : ""}`
      : `/admin/parts-finder/memberships${statusFilter !== "ALL" ? `?status=${statusFilter}` : ""}`;

  return (
    <div>
      <PageHeading variant="dashboard">{PARTS_FINDER_PRODUCT_NAME} · Memberships</PageHeading>
      <p className="mt-2 text-sm text-muted-foreground">
        Membership state is tracked directly and enforced in Parts Finder access control.
      </p>
      {opSuccess ? (
        <div className="mt-4 rounded-lg border border-emerald-600/40 bg-emerald-600/10 p-3 text-xs text-emerald-100">
          {opSuccess}
        </div>
      ) : null}
      {opError ? (
        <div className="mt-4 rounded-lg border border-red-600/40 bg-red-600/10 p-3 text-xs text-red-100">
          {opError}
        </div>
      ) : null}
      <p className="mt-4 text-sm">
        <Link href="/admin/parts-finder" className="text-[var(--brand)] hover:underline">
          ← Analytics overview
        </Link>
        {" · "}
        <Link href="/admin/parts-finder/settings" className="text-[var(--brand)] hover:underline">
          Activation fee settings
        </Link>
        {" · "}
        <Link href="/admin/parts-finder/searches" className="text-[var(--brand)] hover:underline">
          Searches queue
        </Link>
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-muted/40 p-4 dark:bg-white/[0.03]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Active memberships</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 p-4 dark:bg-white/[0.03]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Expired memberships</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{expiredCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 p-4 dark:bg-white/[0.03]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Search reviews pending</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{pendingSearchReviews}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">Parts Finder sessions in PENDING_REVIEW (not payment holds).</p>
        </div>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-background/40 p-3 text-xs text-muted-foreground">
          Pending payment users: <span className="font-semibold text-foreground">{pendingPaymentCount}</span>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3 text-xs text-muted-foreground">
          Pending approval users: <span className="font-semibold text-foreground">{pendingApprovalCount}</span>
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-border bg-background/40 p-3 text-xs text-muted-foreground">
        Suspended memberships: <span className="font-semibold text-foreground">{suspendedCount}</span> · Filter:
        <span className="ml-1 font-semibold text-foreground">{statusFilter}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <Link className="rounded-md border border-border px-2 py-1 hover:bg-muted/40" href="/admin/parts-finder/memberships">All</Link>
        <Link className="rounded-md border border-border px-2 py-1 hover:bg-muted/40" href="/admin/parts-finder/memberships?status=ACTIVE">Active</Link>
        <Link className="rounded-md border border-border px-2 py-1 hover:bg-muted/40" href="/admin/parts-finder/memberships?status=EXPIRED">Expired</Link>
        <Link className="rounded-md border border-border px-2 py-1 hover:bg-muted/40" href="/admin/parts-finder/memberships?status=SUSPENDED">Suspended</Link>
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium">Activated</th>
              <th className="px-4 py-3 font-medium">Expires</th>
              <th className="px-4 py-3 font-medium">Admin actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-muted-foreground" colSpan={6}>
                  No membership activations yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                  <tr key={row.id} className="bg-background/40">
                    <td className="px-4 py-3">{row.user?.email ?? row.user?.name ?? "Unknown user"}</td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{row.reason ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{row.startsAt.toISOString().slice(0, 10)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{row.endsAt.toISOString().slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      {row.user?.id ? (
                        <form className="flex flex-wrap items-center gap-2" action={membershipOpAction}>
                          <input type="hidden" name="userId" value={row.user.id} />
                          <input
                            type="number"
                            name="days"
                            min={1}
                            max={365}
                            placeholder="Days"
                            className="h-8 w-20 rounded-md border border-border bg-background px-2 text-[11px]"
                          />
                          <input
                            name="reason"
                            placeholder="Reason (optional)"
                            className="h-8 w-40 rounded-md border border-border bg-background px-2 text-[11px]"
                          />
                          <button className="rounded-lg border border-border px-2 py-1 text-[11px]" name="action" value="EXTEND" type="submit">
                            Extend
                          </button>
                          <button className="rounded-lg border border-border px-2 py-1 text-[11px]" name="action" value="DEACTIVATE" type="submit">
                            Deactivate
                          </button>
                          <button className="rounded-lg border border-border px-2 py-1 text-[11px]" name="action" value="ACTIVATE" type="submit">
                            Activate
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      )}
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
      {total > 0 ? (
        <ListPaginationFooter
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          itemLabel="Membership activations"
          prevHref={page > 1 ? pageHref(page - 1) : null}
          nextHref={page < totalPages ? pageHref(page + 1) : null}
        />
      ) : null}
    </div>
  );
}
