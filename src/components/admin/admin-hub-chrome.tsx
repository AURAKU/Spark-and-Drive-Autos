"use client";

import { usePathname } from "next/navigation";

import { AdminHubTabs } from "@/components/admin/admin-hub-tabs";
import { getAdminHub, resolveAdminHubId } from "@/lib/admin-nav-hubs";
import { getVisibleHubTabs } from "@/lib/rbac/nav";

/** Renders section tabs for the current admin hub (sidebar stays one link per hub). */
export function AdminHubChrome({ pageKeys }: { pageKeys: string[] }) {
  const pathname = usePathname() || "/admin";
  const hubId = resolveAdminHubId(pathname);
  // Hubs with custom in-page tabs (People, Duty) keep their own chrome.
  if (!hubId || hubId === "command" || hubId === "parts" || hubId === "people" || hubId === "duty") {
    return null;
  }

  const hub = getAdminHub(hubId);
  if (!hub) return null;
  const tabs = getVisibleHubTabs(hub, pageKeys);
  if (tabs.length <= 1) return null;

  return (
    <div className="mb-5 min-w-0 sm:mb-6">
      <p className="sda-readable-subtle text-[11px] font-semibold uppercase tracking-[0.16em]">{hub.label}</p>
      <p className="sda-readable-muted mt-1 max-w-2xl text-xs leading-relaxed sm:mt-1.5">{hub.description}</p>
      <div className="mt-3 sm:mt-4">
        <AdminHubTabs tabs={tabs} label={hub.label} />
      </div>
    </div>
  );
}
