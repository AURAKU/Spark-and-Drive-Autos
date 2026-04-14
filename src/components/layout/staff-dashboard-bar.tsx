import Link from "next/link";
import { cookies } from "next/headers";

import { getStaffOperationsHref, isAdminRole, isSupportStaffRole } from "@/auth";
import { parseViewMode, VIEW_MODE_COOKIE } from "@/lib/view-mode";
import { safeAuth } from "@/lib/safe-auth";

import { ViewModeButton } from "./view-mode-controls";

/**
 * Slim strip under the dashboard hero for staff: reinforces “customer dashboard first”
 * and offers a single clear path to operations. Hidden during customer preview.
 */
export async function StaffDashboardBar() {
  const session = await safeAuth();
  if (!session?.user?.role || !isSupportStaffRole(session.user.role)) return null;

  const jar = await cookies();
  if (parseViewMode(jar.get(VIEW_MODE_COOKIE)?.value) === "user") return null;

  const href = getStaffOperationsHref(session.user.role);
  const fullAdmin = isAdminRole(session.user.role);

  if (fullAdmin) {
    return (
      <div className="border-b border-[var(--brand)]/15 bg-gradient-to-r from-[var(--brand)]/[0.07] via-transparent to-transparent px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-zinc-300 sm:text-sm">
            <span className="font-medium text-zinc-200">Staff</span> — you land on the customer dashboard first. When
            you&apos;re ready, switch to admin for operations. Same session and permissions.
          </p>
          <ViewModeButton targetMode="admin" redirectTo={href} className="w-full shrink-0 sm:w-auto">
            Switch to admin
          </ViewModeButton>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-[var(--brand)]/15 bg-gradient-to-r from-[var(--brand)]/[0.07] via-transparent to-transparent px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-zinc-300 sm:text-sm">
          <span className="font-medium text-zinc-200">Service assistant</span> — open the inbox to help customers with
          inquiries and chat. Admin-only tools stay restricted.
        </p>
        <Link
          href={href}
          className="inline-flex h-9 w-full shrink-0 items-center justify-center rounded-lg bg-[var(--brand)] px-4 text-xs font-semibold text-black transition hover:opacity-90 sm:w-auto sm:text-sm"
        >
          Open support inbox
        </Link>
      </div>
    </div>
  );
}
