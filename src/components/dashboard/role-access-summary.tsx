import Link from "next/link";
import type { UserRole } from "@prisma/client";

import { getEffectiveAdminPageKeys } from "@/lib/rbac/access";
import { getAdminPageDef } from "@/lib/rbac/catalog";
import { ROLE_ACCOUNT_ACCESS, ROLE_JOB_SUMMARY } from "@/lib/rbac/defaults";
import { getStaffOperationsHref, isSupportStaffRole } from "@/lib/roles";

const ROLE_LABEL: Record<UserRole, string> = {
  CUSTOMER: "Customer",
  SERVICE_ASSISTANT: "Service assistant",
  SALES_ADMIN: "Sales admin",
  SOURCING_MANAGER: "Sourcing manager",
  LOGISTICS_MANAGER: "Logistics manager",
  FINANCE_ADMIN: "Finance admin",
  SUPER_ADMIN: "Super admin",
};

export async function RoleAccessSummary({ role }: { role: UserRole }) {
  const account = ROLE_ACCOUNT_ACCESS[role];
  const staff = isSupportStaffRole(role);
  const pageKeys = staff ? await getEffectiveAdminPageKeys(role) : [];
  const grantedLabels = pageKeys
    .map((k) => getAdminPageDef(k)?.label)
    .filter((x): x is string => Boolean(x));
  const opsHref = getStaffOperationsHref(role);

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your access</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">{ROLE_LABEL[role]}</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{ROLE_JOB_SUMMARY[role]}</p>
        </div>
        {staff ? (
          <Link
            href={opsHref}
            className="rounded-lg border border-[var(--brand)]/40 bg-[var(--brand)]/10 px-3 py-2 text-sm font-medium text-foreground transition hover:bg-[var(--brand)]/20"
          >
            Open ops desk
          </Link>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300/90">
            Access granted
          </p>
          <ul className="mt-2 space-y-1 text-xs text-foreground/90">
            {account.granted.map((g) => (
              <li key={g}>· {g}</li>
            ))}
          </ul>
          {staff && grantedLabels.length > 0 ? (
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Admin pages: {grantedLabels.slice(0, 8).join(" · ")}
              {grantedLabels.length > 8 ? ` · +${grantedLabels.length - 8} more` : ""}
            </p>
          ) : null}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-300/90">
            Access denied
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {account.denied.map((d) => (
              <li key={d}>· {d}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
