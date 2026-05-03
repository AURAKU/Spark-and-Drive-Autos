import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AdminRolesReference } from "@/components/admin/admin-roles-reference";
import { PageHeading } from "@/components/typography/page-headings";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { normalizeIntelListPage } from "@/lib/ops";
import { isAdminRole, isSuperAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

import { UsersRolesTabs } from "./users-roles-tabs";
import { UsersTable } from "./users-table";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const PAGE_SIZE = 15;

function readPage(sp: Record<string, string | string[] | undefined>, key: string): number {
  const v = sp[key];
  const s = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  if (s == null || s === "") return 1;
  const n = parseInt(s, 10);
  return normalizeIntelListPage(Number.isFinite(n) ? n : undefined);
}

export default async function AdminUsersPage(props: { searchParams: SearchParams }) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=" + encodeURIComponent("/admin/users"));
  }
  if (!session.user.role || !isAdminRole(session.user.role)) {
    redirect("/admin");
  }

  const sp = await props.searchParams;
  const panelRaw = typeof sp.panel === "string" ? sp.panel : Array.isArray(sp.panel) ? sp.panel[0] : undefined;
  const panel = panelRaw === "roles" ? "roles" : "users";
  const pageReq = readPage(sp, "page");

  const total = panel === "users" ? await prisma.user.count() : 0;
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / PAGE_SIZE));
  const page = Math.min(Math.max(1, pageReq), totalPages);

  const users =
    panel === "users"
      ? await prisma.user.findMany({
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            walletBalance: true,
            createdAt: true,
            messagingBlocked: true,
            accountBlocked: true,
            legalAcceptedAt: true,
            partsFinderMemberships: {
              orderBy: { endsAt: "desc" },
              take: 1,
              select: {
                status: true,
                endsAt: true,
              },
            },
            chats: {
              orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
              take: 1,
              select: { id: true },
            },
          },
        })
      : [];

  const rows = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    role: u.role,
    walletBalance: Number(u.walletBalance),
    createdAt: u.createdAt.toISOString(),
    messagingBlocked: u.messagingBlocked,
    accountBlocked: u.accountBlocked,
    partsFinderMembershipStatus: u.partsFinderMemberships[0]?.status ?? null,
    partsFinderMembershipEndsAt: u.partsFinderMemberships[0]?.endsAt.toISOString() ?? null,
    supportChatThreadId: u.chats[0]?.id ?? null,
    legalAcceptedAt: u.legalAcceptedAt?.toISOString() ?? null,
  }));

  const canManagePrivileged = isSuperAdminRole(session.user.role);
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    params.set("panel", panel);
    if (nextPage > 1) params.set("page", String(nextPage));
    return `/admin/users?${params.toString()}`;
  };

  return (
    <div>
      <PageHeading variant="dashboard">Users &amp; roles</PageHeading>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {panel === "users" ? (
          <>
            All accounts in the system. Ops admins can set roles; the user&apos;s session updates on the next token refresh or
            sign-in. Use <span className="text-foreground/90">Suspend</span> to block sign-in. Open{" "}
            <a href="/admin/comms" className="text-[var(--brand)] hover:underline">
              Live Support
            </a>{" "}
            from the message icon per row (latest thread when available) to manage chat or messaging blocks.
          </>
        ) : (
          <>
            Documentation for each role type. Switch to <span className="text-zinc-300">User directory</span> to assign
            roles and manage accounts.
          </>
        )}
      </p>

      <UsersRolesTabs panel={panel} />
      <div className="mt-4 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <p className="text-xs text-zinc-400">Need to review submitted IDs and approvals?</p>
        <Link
          href="/admin/ghana-card"
          className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-black hover:opacity-90"
        >
          Identification Verification Review
        </Link>
      </div>

      {panel === "users" ? (
        <div className="mt-6">
          <Suspense
            fallback={
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-12 text-center text-sm text-zinc-500">
                Loading user directory…
              </div>
            }
          >
            <UsersTable users={rows} canManagePrivileged={canManagePrivileged} />
          </Suspense>
          {total > 0 ? (
            <ListPaginationFooter
              page={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={PAGE_SIZE}
              itemLabel="Users"
              prevHref={page > 1 ? pageHref(page - 1) : null}
              nextHref={page < totalPages ? pageHref(page + 1) : null}
            />
          ) : null}
        </div>
      ) : (
        <div className="mt-6">
          <AdminRolesReference />
        </div>
      )}
    </div>
  );
}
