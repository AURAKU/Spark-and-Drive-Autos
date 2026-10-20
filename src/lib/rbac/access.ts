import type { UserRole } from "@prisma/client";

import {
  type AdminPageKey,
  firstAllowedAdminHref,
  pathAllowedForPageKeys,
  type EditableStaffRole,
} from "@/lib/rbac/catalog";
import {
  ALL_ADMIN_PAGE_KEYS,
  defaultAdminPageKeysForRole,
  isEditableStaffRole,
} from "@/lib/rbac/defaults";
import { prisma } from "@/lib/prisma";
import { lockedAdminPageKeys, sanitizePageKeysForRole } from "@/lib/rbac/sanitize";

export { lockedAdminPageKeys, sanitizePageKeysForRole };

export async function getRoleAccessOverrideMap(): Promise<Partial<Record<EditableStaffRole, AdminPageKey[]>>> {
  const rows = await prisma.roleAccessOverride.findMany({
    select: { role: true, pageKeys: true },
  });
  const map: Partial<Record<EditableStaffRole, AdminPageKey[]>> = {};
  for (const row of rows) {
    if (!isEditableStaffRole(row.role)) continue;
    const keys = Array.isArray(row.pageKeys)
      ? row.pageKeys.filter((k): k is string => typeof k === "string")
      : [];
    map[row.role] = sanitizePageKeysForRole(row.role, keys);
  }
  return map;
}

export async function getEffectiveAdminPageKeys(role: string | null | undefined): Promise<AdminPageKey[]> {
  if (role === "SUPER_ADMIN") return [...ALL_ADMIN_PAGE_KEYS];
  if (!isEditableStaffRole(role)) return [];
  const override = await prisma.roleAccessOverride.findUnique({
    where: { role },
    select: { pageKeys: true },
  });
  if (!override) return defaultAdminPageKeysForRole(role);
  const keys = Array.isArray(override.pageKeys)
    ? override.pageKeys.filter((k): k is string => typeof k === "string")
    : [];
  return sanitizePageKeysForRole(role, keys);
}

export { canRoleAccessAdminPath, getDefaultOrTokenAdminPageKeys } from "@/lib/rbac/edge";

export async function assertCanAccessAdminPath(role: string | null | undefined, pathname: string) {
  if (role === "SUPER_ADMIN") return true;
  const keys = await getEffectiveAdminPageKeys(role);
  return pathAllowedForPageKeys(pathname, keys);
}

export async function getStaffLandingHref(role: string | null | undefined): Promise<string> {
  if (role === "SUPER_ADMIN") return "/admin";
  const keys = await getEffectiveAdminPageKeys(role);
  return firstAllowedAdminHref(keys);
}

export function roleHasAnyAdminAccess(role: string | null | undefined): boolean {
  if (role === "SUPER_ADMIN") return true;
  if (isEditableStaffRole(role)) return defaultAdminPageKeysForRole(role).length > 0;
  return false;
}

export type RoleAccessMatrixRow = {
  role: UserRole;
  label: string;
  pageKeys: AdminPageKey[];
  isOverride: boolean;
  locked: boolean;
};

const ROLE_LABELS: Record<UserRole, string> = {
  CUSTOMER: "Customer",
  SERVICE_ASSISTANT: "Service assistant",
  SALES_ADMIN: "Sales admin",
  SOURCING_MANAGER: "Sourcing manager",
  LOGISTICS_MANAGER: "Logistics manager",
  FINANCE_ADMIN: "Finance admin",
  SUPER_ADMIN: "Super admin",
};

export async function buildRoleAccessMatrix(): Promise<RoleAccessMatrixRow[]> {
  const overrides = await getRoleAccessOverrideMap();
  const roles: UserRole[] = [
    "CUSTOMER",
    "SERVICE_ASSISTANT",
    "SALES_ADMIN",
    "SOURCING_MANAGER",
    "LOGISTICS_MANAGER",
    "FINANCE_ADMIN",
    "SUPER_ADMIN",
  ];
  return roles.map((role) => {
    if (role === "SUPER_ADMIN") {
      return {
        role,
        label: ROLE_LABELS[role],
        pageKeys: [...ALL_ADMIN_PAGE_KEYS],
        isOverride: false,
        locked: true,
      };
    }
    if (role === "CUSTOMER") {
      return {
        role,
        label: ROLE_LABELS[role],
        pageKeys: [],
        isOverride: false,
        locked: true,
      };
    }
    const override = overrides[role];
    return {
      role,
      label: ROLE_LABELS[role],
      pageKeys: override ?? defaultAdminPageKeysForRole(role),
      isOverride: Boolean(override),
      locked: false,
    };
  });
}
