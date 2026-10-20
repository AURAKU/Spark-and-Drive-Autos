import Link from "next/link";
import { redirect } from "next/navigation";

import { RoleAccessEditor } from "@/components/admin/role-access-editor";
import { PageHeading } from "@/components/typography/page-headings";
import { buildRoleAccessMatrix } from "@/lib/rbac/access";
import { EDITABLE_STAFF_ROLES, type EditableStaffRole, type AdminPageKey } from "@/lib/rbac/catalog";
import { defaultAdminPageKeysForRole, ROLE_ACCOUNT_ACCESS, ROLE_JOB_SUMMARY } from "@/lib/rbac/defaults";
import { isSuperAdminRole } from "@/lib/roles";
import { safeAuth } from "@/lib/safe-auth";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  const session = await safeAuth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=" + encodeURIComponent("/admin/roles"));
  }
  if (!isSuperAdminRole(session.user.role)) {
    redirect("/admin?error=role-access-denied");
  }

  const matrix = await buildRoleAccessMatrix();
  const editableRows = matrix
    .filter((r): r is typeof r & { role: EditableStaffRole } =>
      EDITABLE_STAFF_ROLES.includes(r.role as EditableStaffRole),
    )
    .map((r) => ({
      role: r.role as EditableStaffRole,
      label: r.label,
      pageKeys: r.pageKeys,
      isOverride: r.isOverride,
    }));

  const defaultsByRole = Object.fromEntries(
    EDITABLE_STAFF_ROLES.map((role) => [role, defaultAdminPageKeysForRole(role)]),
  ) as Record<EditableStaffRole, AdminPageKey[]>;

  return (
    <div>
      <PageHeading variant="dashboard">Role access</PageHeading>
      <p className="mt-2 max-w-3xl text-sm text-zinc-400">
        Only Super Admin can change these grants. Staff roles start from tight job-title defaults; you can add or remove
        admin pages per role. System pages (users, settings, audit, security, legal, bulk import) stay Super Admin only.
      </p>
      <p className="mt-3 text-sm text-zinc-500">
        <Link href="/admin/users?panel=roles" className="text-[var(--brand)] hover:underline">
          Role reference
        </Link>
        {" · "}
        <Link href="/admin/users" className="text-[var(--brand)] hover:underline">
          Assign roles in Users
        </Link>
      </p>

      <div className="mt-10">
        <RoleAccessEditor rows={editableRows} defaultsByRole={defaultsByRole} />
      </div>

      <div className="mt-14 space-y-4">
        <h2 className="text-lg font-semibold text-white">Account pages by role</h2>
        <p className="max-w-2xl text-sm text-zinc-400">
          What each role should expect on the personal dashboard vs operations console.
        </p>
        <ul className="space-y-3">
          {(Object.keys(ROLE_ACCOUNT_ACCESS) as (keyof typeof ROLE_ACCOUNT_ACCESS)[]).map((role) => {
            const account = ROLE_ACCOUNT_ACCESS[role];
            return (
              <li key={role} className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
                <p className="font-medium text-white">{matrix.find((m) => m.role === role)?.label ?? role}</p>
                <p className="mt-1 text-sm text-zinc-400">{ROLE_JOB_SUMMARY[role]}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300/90">Access granted</p>
                    <ul className="mt-1 space-y-1 text-xs text-zinc-300">
                      {account.granted.map((g) => (
                        <li key={g}>· {g}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-300/90">Access denied</p>
                    <ul className="mt-1 space-y-1 text-xs text-zinc-400">
                      {account.denied.map((d) => (
                        <li key={d}>· {d}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
