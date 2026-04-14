import type { UserRole } from "@prisma/client";

const ADMIN_ROLES = new Set<string>([
  "SUPER_ADMIN",
  "SALES_ADMIN",
  "SOURCING_MANAGER",
  "LOGISTICS_MANAGER",
  "FINANCE_ADMIN",
]);

/** Full admin console (inventory, payments, settings, etc.) — excludes service assistants. */
export function isAdminRole(role: UserRole | string | undefined | null): boolean {
  return role != null && ADMIN_ROLES.has(role);
}

/** Customer-facing support: full admins + assigned service assistants (inbox + inquiries only). */
export function isSupportStaffRole(role: UserRole | string | undefined | null): boolean {
  return isAdminRole(role) || role === "SERVICE_ASSISTANT";
}

export function isSuperAdminRole(role: UserRole | string | undefined | null): boolean {
  return role === "SUPER_ADMIN";
}

/**
 * Where “operations” entry points should send staff. Assistants are restricted to support routes.
 */
export function getStaffOperationsHref(role: UserRole | string | undefined | null): string {
  if (isAdminRole(role)) return "/admin";
  if (role === "SERVICE_ASSISTANT") return "/admin/comms";
  return "/dashboard";
}
