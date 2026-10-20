import type { AdminNavLink } from "@/components/layout/admin-mobile-nav";
import {
  ADMIN_NAV_HUBS,
  filterHubTabs,
  hubVisibleForKeys,
  resolveAdminHubId,
  type AdminHubDef,
} from "@/lib/admin-nav-hubs";
import { ADMIN_PAGE_CATALOG } from "@/lib/rbac/catalog";

function allowedSet(pageKeys: readonly string[]) {
  return new Set(pageKeys.includes("*") ? ADMIN_PAGE_CATALOG.map((p) => p.key) : pageKeys);
}

/** Sidebar: one link per hub the role can open (related tools live in hub tabs). */
export function buildAdminNavLinks(pageKeys: readonly string[]): AdminNavLink[] {
  const allowed = allowedSet(pageKeys);
  const links: AdminNavLink[] = [];
  for (const hub of ADMIN_NAV_HUBS) {
    if (!hubVisibleForKeys(hub, allowed)) continue;
    const tabs = filterHubTabs(hub, allowed);
    const href = tabs[0]?.href ?? hub.href;
    links.push({ href, label: hub.label, hubId: hub.id });
  }
  return links;
}

export function getVisibleHubTabs(hub: AdminHubDef, pageKeys: readonly string[]) {
  return filterHubTabs(hub, allowedSet(pageKeys)).map((t) => ({
    id: t.id,
    label: t.label,
    href: t.href,
  }));
}

export function sidebarLinkActive(pathname: string, link: AdminNavLink): boolean {
  const current = resolveAdminHubId(pathname);
  if (link.hubId) return current === link.hubId;
  return pathname === link.href || (link.href !== "/admin" && pathname.startsWith(link.href));
}
