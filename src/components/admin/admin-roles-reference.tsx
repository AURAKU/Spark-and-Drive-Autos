import Link from "next/link";

import { buildRoleAccessMatrix } from "@/lib/rbac/access";
import { ADMIN_PAGE_CATALOG, getAdminPageDef } from "@/lib/rbac/catalog";
import { ROLE_ACCOUNT_ACCESS, ROLE_JOB_SUMMARY } from "@/lib/rbac/defaults";
import { isSuperAdminRole } from "@/lib/roles";
import { safeAuth } from "@/lib/safe-auth";

export async function AdminRolesReference() {
  const session = await safeAuth();
  const canEdit = Boolean(session?.user?.role && isSuperAdminRole(session.user.role));
  const matrix = await buildRoleAccessMatrix();

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Role reference</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Access is enforced in middleware and the admin layout. Super Admin owns every page and can customize staff
            grants under Role access. Assign people from the User directory tab.
          </p>
        </div>
        {canEdit ? (
          <Link
            href="/admin/roles"
            className="rounded-lg border border-[var(--brand)]/40 bg-[var(--brand)]/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand)]/20"
          >
            Edit role access
          </Link>
        ) : null}
      </div>

      <ul className="mt-8 space-y-4">
        {matrix.map((r) => {
          const account = ROLE_ACCOUNT_ACCESS[r.role];
          const grantedPages = r.pageKeys
            .map((k) => getAdminPageDef(k)?.label)
            .filter((x): x is string => Boolean(x));
          const deniedPages = ADMIN_PAGE_CATALOG.filter((p) => !r.pageKeys.includes(p.key) && r.role !== "SUPER_ADMIN").map(
            (p) => p.label,
          );

          return (
            <li key={r.role} className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-white">{r.label}</p>
                {r.isOverride ? (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-100">
                    Customized
                  </span>
                ) : null}
                {r.locked ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                    Fixed
                  </span>
                ) : null}
              </div>
              <p className="mt-1 font-mono text-xs text-zinc-500">{r.role}</p>
              <p className="mt-2 text-sm text-zinc-400">{ROLE_JOB_SUMMARY[r.role]}</p>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300/90">
                    Admin access granted
                  </p>
                  {r.role === "CUSTOMER" ? (
                    <p className="mt-1 text-xs text-zinc-500">None. Storefront and personal dashboard only.</p>
                  ) : r.role === "SUPER_ADMIN" ? (
                    <p className="mt-1 text-xs text-zinc-300">All admin pages ({ADMIN_PAGE_CATALOG.length}).</p>
                  ) : (
                    <p className="mt-1 text-xs leading-relaxed text-zinc-300">
                      {grantedPages.length ? grantedPages.join(" · ") : "No admin pages (misconfigured)."}
                    </p>
                  )}
                  {r.role !== "CUSTOMER" && r.role !== "SUPER_ADMIN" && deniedPages.length > 0 ? (
                    <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-rose-300/80">
                      Admin access denied
                    </p>
                  ) : null}
                  {r.role !== "CUSTOMER" && r.role !== "SUPER_ADMIN" && deniedPages.length > 0 ? (
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                      {deniedPages.slice(0, 12).join(" · ")}
                      {deniedPages.length > 12 ? ` · +${deniedPages.length - 12} more` : ""}
                    </p>
                  ) : null}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300/90">Account pages</p>
                  <ul className="mt-1 space-y-1 text-xs text-zinc-300">
                    {account.granted.map((g) => (
                      <li key={g}>· {g}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-rose-300/80">Account denied</p>
                  <ul className="mt-1 space-y-1 text-xs text-zinc-500">
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
  );
}
