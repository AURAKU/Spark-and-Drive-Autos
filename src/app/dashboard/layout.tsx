import { cookies } from "next/headers";
import Link from "next/link";

import { getStaffOperationsHref, isAdminRole, isSupportStaffRole } from "@/auth";
import { CurrencySwitcher } from "@/components/layout/currency-switcher";
import { DashboardMobileNav } from "@/components/layout/dashboard-mobile-nav";
import { DashboardSidebarNav } from "@/components/layout/dashboard-sidebar-nav";
import { DashboardTopHeader } from "@/components/layout/dashboard-top-header";
import { LegalReacceptanceGate } from "@/components/legal/legal-reacceptance-gate";
import { StaffDashboardBar } from "@/components/layout/staff-dashboard-bar";
import { ViewModeButton } from "@/components/layout/view-mode-controls";
import { parseDisplayCurrency } from "@/lib/currency";
import { getMissingRequiredPolicies } from "@/lib/legal-reacceptance";
import { prisma } from "@/lib/prisma";
import { parseViewMode, VIEW_MODE_COOKIE } from "@/lib/view-mode";
import { requireActiveSessionOrRedirect } from "@/lib/auth-helpers";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/notifications", label: "Notifications" },
  { href: "/dashboard/favorites", label: "Favorites & Cart" },
  { href: "/dashboard/orders", label: "All Orders" },
  { href: "/dashboard/payments", label: "All Payments" },
  { href: "/dashboard/shipping", label: "Shipping & Delivery Tracking" },
  { href: "/dashboard/estimates", label: "Duty Estimates" },
  { href: "/dashboard/parts-finder", label: "Parts Finder", ctaStyle: "parts-finder" as const },
  { href: "/dashboard/inquiry-requests", label: "Customer Inquiry & Request" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireActiveSessionOrRedirect("/dashboard");
  const role = session.user.role;
  const isStaff = Boolean(role && (isAdminRole(role) || isSupportStaffRole(role)));
  if (!isStaff) {
    const missingPolicies = await getMissingRequiredPolicies(session.user.id);
    if (missingPolicies.length > 0) {
      return (
        <LegalReacceptanceGate
          policies={missingPolicies.map((policy) => ({
            id: policy.id,
            policyKey: policy.policyKey,
            title: policy.title,
            version: policy.version,
            effectiveAt: policy.effectiveAt.toISOString(),
            content: policy.content,
          }))}
          defaultRedirectTo="/dashboard"
        />
      );
    }
  }
  const cookieStore = await cookies();
  const displayCurrency = parseDisplayCurrency(cookieStore.get("sda_currency")?.value);
  const viewMode = parseViewMode(cookieStore.get(VIEW_MODE_COOKIE)?.value);
  const admin = Boolean(role && isAdminRole(role));
  const supportStaff = Boolean(role && isSupportStaffRole(role));
  const staffOpsHref = getStaffOperationsHref(session?.user?.role);
  const unread =
    session?.user?.id != null
      ? await prisma.notification.count({ where: { userId: session.user.id, read: false } })
      : 0;

  return (
    <div className="flex min-h-screen min-w-0 flex-col">
      <DashboardTopHeader />
      <StaffDashboardBar />
      <div className="flex min-h-0 min-w-0 flex-1">
        <aside className="hidden w-64 shrink-0 self-start border-r border-sidebar-border bg-sidebar p-6 text-sidebar-foreground lg:sticky lg:top-0 lg:block lg:max-h-[100dvh] lg:overflow-y-auto lg:overscroll-y-contain">
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">Customer</p>
          <p className="mt-2 text-sm font-medium text-sidebar-foreground">{session?.user?.name ?? session?.user?.email}</p>
          {supportStaff && !admin ? (
            <div className="mt-4 rounded-xl border border-[var(--brand)]/25 bg-[var(--brand)]/[0.06] p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--brand)]">Support</p>
              <p className="mt-1 text-xs text-muted-foreground">Reply to customers in Live Support Chat — same threads as the full team.</p>
              <Link
                href={staffOpsHref}
                className="mt-3 flex w-full items-center justify-center rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-semibold text-black transition hover:opacity-90"
              >
                Open inbox
              </Link>
            </div>
          ) : null}
          {admin && (
            <div
              className={`mt-4 rounded-xl border p-3 ${
                viewMode === "user"
                  ? "border-amber-500/25 bg-amber-500/[0.07]"
                  : "border-border bg-muted/50 dark:border-white/10 dark:bg-white/[0.04]"
              }`}
            >
              {viewMode === "user" ? (
                <>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-amber-200/90">Operations</p>
                  <p className="mt-1 text-xs text-muted-foreground">User-mode preview active for customer workflow checks.</p>
                  <ViewModeButton targetMode="admin" redirectTo={staffOpsHref} className="mt-3 w-full">
                    Switch to admin
                  </ViewModeButton>
                </>
              ) : (
                <>
                  <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Operations</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Customer dashboard first — switch to admin when you need tools.
                  </p>
                  <ViewModeButton targetMode="admin" redirectTo={staffOpsHref} className="mt-3 w-full">
                    Switch to admin
                  </ViewModeButton>
                  <ViewModeButton targetMode="user" redirectTo="/dashboard" variant="outline" className="mt-2 w-full">
                    Preview as customer
                  </ViewModeButton>
                </>
              )}
            </div>
          )}
          <div className="mt-6 rounded-xl border border-border bg-muted/40 p-3 dark:border-white/10 dark:bg-white/[0.02]">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Currency</p>
            <div className="mt-2">
              <CurrencySwitcher initial={displayCurrency} />
            </div>
            <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
              Matches storefront currency. Checkout is settled in GHS.
            </p>
          </div>
          <DashboardSidebarNav links={links} unreadByHref={{ "/dashboard/notifications": unread }} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
          {admin ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-sidebar px-4 py-3 lg:hidden dark:border-white/10">
              <ViewModeButton targetMode="admin" redirectTo={staffOpsHref} className="min-h-9 flex-1 text-xs sm:flex-none">
                Switch to admin
              </ViewModeButton>
              {viewMode === "user" ? null : (
                <ViewModeButton
                  targetMode="user"
                  redirectTo="/dashboard"
                  variant="outline"
                  className="min-h-9 flex-1 text-xs sm:flex-none"
                >
                  Preview as customer
                </ViewModeButton>
              )}
            </div>
          ) : null}
          <div className="relative border-b border-border px-4 py-3 lg:hidden dark:border-white/10">
            <div className="flex min-h-10 items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <DashboardMobileNav
                  links={links}
                  sectionLabel="Your dashboard"
                  unreadByHref={{ "/dashboard/notifications": unread }}
                />
                <Link href="/dashboard" className="truncate text-sm font-medium text-[var(--brand)]">
                  Overview
                </Link>
              </div>
              <CurrencySwitcher initial={displayCurrency} compact />
            </div>
          </div>
          <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-6 sm:py-10">{children}</div>
        </div>
      </div>
    </div>
  );
}
