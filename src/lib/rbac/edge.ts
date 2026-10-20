/**
 * Edge-safe RBAC helpers for middleware / auth.config (no Prisma).
 */
import { pathAllowedForPageKeys } from "@/lib/rbac/catalog";
import { defaultAdminPageKeysForRole, isEditableStaffRole } from "@/lib/rbac/defaults";
import { sanitizePageKeysForRole } from "@/lib/rbac/sanitize";

export function getDefaultOrTokenAdminPageKeys(
  role: string | null | undefined,
  tokenKeys?: string[] | null,
): string[] {
  if (role === "SUPER_ADMIN") return ["*"];
  if (Array.isArray(tokenKeys) && tokenKeys.length > 0) {
    if (isEditableStaffRole(role)) {
      return sanitizePageKeysForRole(role, tokenKeys);
    }
    return tokenKeys;
  }
  return defaultAdminPageKeysForRole(role);
}

export function canRoleAccessAdminPath(
  role: string | null | undefined,
  pathname: string,
  tokenKeys?: string[] | null,
): boolean {
  if (role === "SUPER_ADMIN") return true;
  if (role === "CUSTOMER" || !role) return false;
  const keys = getDefaultOrTokenAdminPageKeys(role, tokenKeys);
  return pathAllowedForPageKeys(pathname, keys);
}
