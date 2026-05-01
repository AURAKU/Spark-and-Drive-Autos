import Link from "next/link";
import { redirect } from "next/navigation";

import { isSuperAdminRole } from "@/auth";
import { AdminMobileNav, type AdminNavLink } from "@/components/layout/admin-mobile-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ViewModeButton } from "@/components/layout/view-mode-controls";
import { DashboardTopHeader } from "@/components/layout/dashboard-top-header";
import { safeAuth } from "@/lib/safe-auth";

const fullAdminLinks: AdminNavLink[] = [
  { href: "/admin", label: "Command Center" },
  { href: "/admin/health", label: "System health" },
  { href: "/admin/users", label: "All Users" },
  { href: "/admin/cars", label: "Cars Inventory" },
  { href: "/admin/parts", label: "Parts Management" },
  { href: "/admin/orders", label: "All Orders" },
  { href: "/admin/payments/intelligence", label: "Payment intelligence" },
  { href: "/admin/shipping", label: "Shipping & Delivery Tracking" },
  { href: "/admin/duty", label: "Duty Tracking" },
  { href: "/admin/security", label: "Security Surveillance" },
  { href: "/admin/settings/currency", label: "Exchange Rates" },
  { href: "/admin/legal", label: "Legal Controls" },
  { href: "/admin/disputes", label: "Disputes & Chargebacks" },
  { href: "/admin/parts-finder", label: "Parts Finder" },
  { href: "/admin/comms", label: "Live Support Chat" },
  { href: "/admin/settings/receipt-template", label: "Receipt Templates" },
  { href: "/admin/settings", label: "API Providers and Environment" },
  { href: "/admin/reviews", label: "All Reviews" },
  { href: "/admin/import-export", label: "BULK Imports & Export Inventory" },
  { href: "/admin/duplicates", label: "Duplicate Inventory" },
  { href: "/admin/audit", label: "Audit logs" },
];

const assistantLinks: AdminNavLink[] = [
  { href: "/admin/comms", label: "Live Support Chat" },
];

const superAdminOnlyLinks = new Set(["/admin/settings"]);

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await safeAuth();
  if (session?.user?.accountBlocked) {
    redirect("/login?error=account-suspended&callbackUrl=" + encodeURIComponent("/admin"));
  }
  const isAssistant = session?.user?.role === "SERVICE_ASSISTANT";
  const isSuperAdmin = Boolean(session?.user?.role && isSuperAdminRole(session.user.role));
  const links = (isAssistant ? assistantLinks : fullAdminLinks).filter((link) => isSuperAdmin || !superAdminOnlyLinks.has(link.href));

  return (
    <div className="flex min-h-screen min-w-0 flex-col">
      <DashboardTopHeader showPartnerStrip={false} />
      <div className="flex min-h-0 min-w-0 flex-1">
        <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar p-5 text-sidebar-foreground lg:block">
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            {isAssistant ? "Support inbox" : "Operations"}
          </p>
          <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3 dark:border-white/10 dark:bg-white/[0.03]">
            <ViewModeButton targetMode="user" redirectTo="/dashboard" className="w-full">
              Back to user view
            </ViewModeButton>
            <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
              Returns to the customer dashboard — same session, same account.
            </p>
          </div>
          <nav className="mt-6 space-y-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="inline-flex h-8 w-full items-center justify-start rounded-lg px-2.5 text-sm text-sidebar-foreground/90 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
          <div className="relative border-b border-border px-4 py-3 lg:hidden dark:border-white/10">
            <div className="flex min-h-10 items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <AdminMobileNav links={links} sectionLabel={isAssistant ? "Support inbox" : "Operations"} />
                <Link href="/admin" className="truncate text-sm font-medium text-[var(--brand)]">
                  Command Center
                </Link>
              </div>
              <ViewModeButton targetMode="user" redirectTo="/dashboard" className="shrink-0 text-[11px]">
                Back to user view
              </ViewModeButton>
            </div>
            <div className="pointer-events-none absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center">
              <ThemeToggle className="pointer-events-auto" />
            </div>
          </div>
          <div className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6 sm:py-10">{children}</div>
        </div>
      </div>
    </div>
  );
}
