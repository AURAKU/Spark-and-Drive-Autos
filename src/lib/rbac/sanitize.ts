import { ADMIN_PAGE_CATALOG, type AdminPageKey, type EditableStaffRole } from "@/lib/rbac/catalog";

const ALL_KEYS = new Set(ADMIN_PAGE_CATALOG.map((p) => p.key));
const LOCKED_KEYS = new Set(ADMIN_PAGE_CATALOG.filter((p) => p.superAdminLocked).map((p) => p.key));

export function lockedAdminPageKeys(): AdminPageKey[] {
  return [...LOCKED_KEYS];
}

/** Drop unknowns; strip Super-Admin-locked keys from staff role grants. */
export function sanitizePageKeysForRole(role: EditableStaffRole, keys: string[]): AdminPageKey[] {
  void role;
  const out: AdminPageKey[] = [];
  for (const raw of keys) {
    if (!ALL_KEYS.has(raw as AdminPageKey)) continue;
    const key = raw as AdminPageKey;
    if (LOCKED_KEYS.has(key)) continue;
    if (!out.includes(key)) out.push(key);
  }
  return out;
}
