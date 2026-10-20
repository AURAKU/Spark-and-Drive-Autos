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
 * Where “operations” entry points should send staff.
 * Prefer role defaults (overrides apply after JWT refresh / landing via middleware).
 */
export function getStaffOperationsHref(role: UserRole | string | undefined | null): string {
  if (role === "SUPER_ADMIN") return "/admin";
  if (role === "SERVICE_ASSISTANT") return "/admin/comms";
  if (role === "SALES_ADMIN") return "/admin";
  if (role === "SOURCING_MANAGER") return "/admin/parts";
  if (role === "LOGISTICS_MANAGER") return "/admin/shipping";
  if (role === "FINANCE_ADMIN") return "/admin/payments/intelligence";
  if (isAdminRole(role)) return "/admin";
  return "/dashboard";
}
