import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { isSuperAdminRole } from "@/auth";
import { AdminHubChrome } from "@/components/admin/admin-hub-chrome";
import { AdminMobileNav } from "@/components/layout/admin-mobile-nav";
import { AdminSidebarNav } from "@/components/layout/admin-sidebar-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ViewModeButton } from "@/components/layout/view-mode-controls";
import { DashboardTopHeader } from "@/components/layout/dashboard-top-header";
import { getEffectiveAdminPageKeys } from "@/lib/rbac/access";
import { buildAdminNavLinks } from "@/lib/rbac/nav";
import { isAdminRole, isSupportStaffRole } from "@/lib/roles";
import { safeAuth } from "@/lib/safe-auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=" + encodeURIComponent("/admin"));
  }
  if (session.user.accountBlocked) {
    redirect("/login?error=account-suspended&callbackUrl=" + encodeURIComponent("/admin"));
  }

  const role = session.user.role;
  const isStaff = Boolean(role && (isAdminRole(role) || isSupportStaffRole(role)));
  if (!isStaff) {
    redirect("/dashboard");
  }

  const isSuperAdmin = Boolean(role && isSuperAdminRole(role));
  const pageKeys = await getEffectiveAdminPageKeys(role);
  if (pageKeys.length === 0 && !isSuperAdmin) {
    redirect("/dashboard");
  }

  const navKeys = isSuperAdmin ? (["*"] as string[]) : pageKeys;
  const links = buildAdminNavLinks(navKeys);
  const sectionLabel =
    role === "SERVICE_ASSISTANT" ? "Support inbox" : isSuperAdmin ? "Operations" : "Your ops desk";

  return (
    <div className="flex min-h-screen min-w-0 flex-col">
      <DashboardTopHeader showPartnerStrip={false} />
      <div className="flex min-h-0 min-w-0 flex-1">
        <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar p-5 text-sidebar-foreground lg:block">
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">{sectionLabel}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Role: <span className="font-medium text-sidebar-foreground">{role}</span>
          </p>
          <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3 dark:border-white/10 dark:bg-white/[0.03]">
            <ViewModeButton targetMode="user" redirectTo="/dashboard" className="w-full">
              Back to user view
            </ViewModeButton>
            <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
              Returns to the customer dashboard — same session, same account.
            </p>
          </div>
          <AdminSidebarNav links={links} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
          <div className="relative border-b border-border px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:px-4 lg:hidden dark:border-white/10">
            <div className="flex min-h-11 flex-wrap items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <AdminMobileNav links={links} sectionLabel={sectionLabel} />
                <Link
                  href={links[0]?.href ?? "/dashboard"}
                  className="min-w-0 truncate text-sm font-medium text-[var(--brand)]"
                >
                  {links[0]?.label ?? "Dashboard"}
                </Link>
              </div>
              <div className="sda-action-row ml-auto">
                <ThemeToggle />
                <ViewModeButton targetMode="user" redirectTo="/dashboard" className="text-[11px]">
                  User view
                </ViewModeButton>
              </div>
            </div>
          </div>
          <div className="sda-main-safe mx-auto w-full max-w-6xl py-6 sm:py-10">
            <Suspense fallback={null}>
              <AdminHubChrome pageKeys={navKeys} />
            </Suspense>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
