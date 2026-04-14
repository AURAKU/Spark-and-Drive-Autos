import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminMobileNav, type AdminNavLink } from "@/components/layout/admin-mobile-nav";
import { ViewModeButton } from "@/components/layout/view-mode-controls";
import { DashboardTopHeader } from "@/components/layout/dashboard-top-header";
import { safeAuth } from "@/lib/safe-auth";

const fullAdminLinks: AdminNavLink[] = [
  { href: "/admin", label: "Command Center" },
  { href: "/admin/cars", label: "Cars Inventory" },
  { href: "/admin/parts", label: "Parts Management" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/comms", label: "Live Support Chat" },
  { href: "/admin/orders", label: "All Orders" },
  { href: "/admin/legal", label: "Legal controls" },
  { href: "/admin/security", label: "Security surveillance" },
  { href: "/admin/payments/intelligence", label: "Payment intelligence" },
  { href: "/admin/shipping", label: "Shipping" },
  { href: "/admin/duty", label: "Duty" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/settings", label: "API providers" },
  { href: "/admin/settings/receipt-template", label: "Receipt templates" },
  { href: "/admin/settings/currency", label: "Exchange rates" },
  { href: "/admin/import-export", label: "BULK Imports & Export Inventory" },
  { href: "/admin/duplicates", label: "Duplicate inventory" },
  { href: "/admin/audit", label: "Audit log" },
];

const assistantLinks: AdminNavLink[] = [
  { href: "/admin/comms", label: "Live Support Chat" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await safeAuth();
  if (session?.user?.accountBlocked) {
    redirect("/login?error=account-suspended&callbackUrl=" + encodeURIComponent("/admin"));
  }
  const isAssistant = session?.user?.role === "SERVICE_ASSISTANT";
  const links = isAssistant ? assistantLinks : fullAdminLinks;

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardTopHeader showPartnerStrip={false} />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar p-5 text-sidebar-foreground xl:block">
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
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 xl:hidden dark:border-white/10">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <AdminMobileNav links={links} sectionLabel={isAssistant ? "Support inbox" : "Operations"} />
              <Link href="/admin" className="truncate text-sm text-[var(--brand)]">
                Command Center
              </Link>
            </div>
            <ViewModeButton targetMode="user" redirectTo="/dashboard" className="text-[11px]">
              Back to user view
            </ViewModeButton>
          </div>
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
