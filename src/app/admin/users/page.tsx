import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AdminRolesReference } from "@/components/admin/admin-roles-reference";
import { PageHeading } from "@/components/typography/page-headings";
import { isAdminRole, isSuperAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

import { UsersRolesTabs } from "./users-roles-tabs";
import { UsersTable } from "./users-table";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

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

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 400,
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
    },
  });

  const rows = users.map((u) => ({
    ...u,
    walletBalance: Number(u.walletBalance),
    createdAt: u.createdAt.toISOString(),
  }));

  const canManagePrivileged = isSuperAdminRole(session.user.role);

  return (
    <div>
      <PageHeading variant="dashboard">Users &amp; roles</PageHeading>
      <p className="mt-2 max-w-2xl text-sm text-zinc-400">
        {panel === "users" ? (
          <>
            All accounts in the system. Ops admins can set any user&apos;s role; changes are stored in the database and
            the table reloads after each save. The user&apos;s own session updates on the next token refresh (usually
            within a short interval) or when they sign in again. Use{" "}
            <span className="text-zinc-300">Suspend account</span> to block sign-in and authenticated areas for policy
            or safety reasons. Live Support &quot;Blocked&quot; only stops chat messages — manage that from{" "}
            <a href="/admin/comms" className="text-[var(--brand)] hover:underline">
              Live Support Chat
            </a>
            .
          </>
        ) : (
          <>
            Documentation for each role type. Switch to <span className="text-zinc-300">User directory</span> to assign
            roles and manage accounts.
          </>
        )}
      </p>

      <UsersRolesTabs panel={panel} />

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
        </div>
      ) : (
        <div className="mt-6">
          <AdminRolesReference />
        </div>
      )}
    </div>
  );
}
