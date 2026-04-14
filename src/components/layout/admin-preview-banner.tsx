import { cookies } from "next/headers";

import { isAdminRole } from "@/auth";
import { parseViewMode, VIEW_MODE_COOKIE } from "@/lib/view-mode";
import { safeAuth } from "@/lib/safe-auth";

import { ViewModeButton } from "./view-mode-controls";

/**
 * Shown on public storefront when a staff account is in “user view” (customer preview).
 */
export async function AdminPreviewBanner() {
  const session = await safeAuth();
  if (!session?.user?.role || !isAdminRole(session.user.role)) return null;

  const jar = await cookies();
  if (parseViewMode(jar.get(VIEW_MODE_COOKIE)?.value) !== "user") return null;

  return (
    <div className="border-b border-amber-500/25 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent px-4 py-2.5 sm:py-2">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
        <p className="text-xs text-amber-100/95 sm:text-sm">
          <span className="font-semibold text-amber-50">Customer preview</span>
          <span className="text-amber-100/80"> — you’re still signed in as staff; this only changes shortcuts.</span>
        </p>
        <ViewModeButton targetMode="admin" redirectTo="/admin" variant="outline" className="shrink-0 border-amber-500/30 text-amber-50">
          Switch to admin
        </ViewModeButton>
      </div>
    </div>
  );
}
