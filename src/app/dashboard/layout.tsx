import { cookies } from "next/headers";
import Link from "next/link";

import { getStaffOperationsHref, isAdminRole, isSupportStaffRole } from "@/auth";
import { AdminPreviewBanner } from "@/components/layout/admin-preview-banner";
import { CurrencySwitcher } from "@/components/layout/currency-switcher";
import { DashboardTopHeader } from "@/components/layout/dashboard-top-header";
import { StaffDashboardBar } from "@/components/layout/staff-dashboard-bar";
import { ViewModeButton } from "@/components/layout/view-mode-controls";
import { parseDisplayCurrency } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { parseViewMode, VIEW_MODE_COOKIE } from "@/lib/view-mode";
import { requireActiveSessionOrRedirect } from "@/lib/auth-helpers";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/notifications", label: "Notifications" },
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/favorites", label: "Favorites" },
  { href: "/dashboard/inquiries", label: "Customer Inquiry" },
  { href: "/dashboard/requests", label: "Requests" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/payments", label: "Payments" },
  { href: "/dashboard/shipping", label: "Shipping" },
  { href: "/dashboard/chats", label: "Chats" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireActiveSessionOrRedirect("/dashboard");
  const cookieStore = await cookies();
  const displayCurrency = parseDisplayCurrency(cookieStore.get("sda_currency")?.value);
  const viewMode = parseViewMode(cookieStore.get(VIEW_MODE_COOKIE)?.value);
  const admin = session?.user?.role && isAdminRole(session.user.role);
  const supportStaff = session?.user?.role && isSupportStaffRole(session.user.role);
  const staffOpsHref = getStaffOperationsHref(session?.user?.role);
  const unread =
    session?.user?.id != null
      ? await prisma.notification.count({ where: { userId: session.user.id, read: false } })
      : 0;

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardTopHeader />
      <StaffDashboardBar />
      <AdminPreviewBanner />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar p-6 text-sidebar-foreground lg:block">
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
                  <p className="text-[10px] font-medium uppercase tracking-wide text-amber-200/90">Customer preview</p>
                  <p className="mt-1 text-xs text-muted-foreground">Same session and RBAC — navigation emphasis only.</p>
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
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Display prices</p>
            <div className="mt-2">
              <CurrencySwitcher initial={displayCurrency} />
            </div>
            <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
              Matches storefront currency. Checkout is settled in GHS.
            </p>
          </div>
          <nav className="mt-8 space-y-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="inline-flex h-8 w-full items-center justify-between rounded-lg px-2.5 text-sm text-sidebar-foreground/90 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <span>{l.label}</span>
                {l.href === "/dashboard/notifications" && unread > 0 ? (
                  <span className="rounded-full bg-[var(--brand)]/20 px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex-1">
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 lg:hidden dark:border-white/10">
            <Link href="/dashboard" className="text-sm text-[var(--brand)]">
              Dashboard menu (use desktop for full nav)
            </Link>
            <CurrencySwitcher initial={displayCurrency} />
          </div>
          <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
