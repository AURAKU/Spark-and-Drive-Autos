import {
  ADMIN_PAGE_CATALOG,
  type AdminPageKey,
  type EditableStaffRole,
  EDITABLE_STAFF_ROLES,
} from "@/lib/rbac/catalog";

/** Mirrors Prisma UserRole — kept local so edge middleware never loads Prisma. */
export type RbacUserRole =
  | "CUSTOMER"
  | "SERVICE_ASSISTANT"
  | "SUPER_ADMIN"
  | "SALES_ADMIN"
  | "SOURCING_MANAGER"
  | "LOGISTICS_MANAGER"
  | "FINANCE_ADMIN";

/** All catalog keys — Super Admin only by default. */
export const ALL_ADMIN_PAGE_KEYS: AdminPageKey[] = ADMIN_PAGE_CATALOG.map((p) => p.key);

/**
 * Tight defaults by job title. Super Admin can raise/lower grants in /admin/roles
 * (except locked system pages which stay Super Admin–only).
 */
export const DEFAULT_ROLE_ADMIN_PAGES: Record<EditableStaffRole, readonly AdminPageKey[]> = {
  SERVICE_ASSISTANT: [
    "comms",
    "chats",
    "inquiries",
    "order_inquiries",
    "ghana_card",
  ],
  SALES_ADMIN: [
    "command_center",
    "cars",
    "motorcycles",
    "parts",
    "leads",
    "quotes",
    "estimates",
    "inquiries",
    "order_inquiries",
    "orders",
    "reviews",
    "duplicates",
    "comms",
    "ghana_card",
    "verifications",
  ],
  SOURCING_MANAGER: [
    "command_center",
    "parts",
    "parts_finder",
    "parts_request_fee",
    "verified_parts",
    "requests",
    "estimates",
    "duty_estimator",
    "duplicates",
    "orders",
  ],
  LOGISTICS_MANAGER: [
    "command_center",
    "shipping",
    "orders",
    "order_inquiries",
    "deposit_balances",
    "duty",
    "duty_estimator",
  ],
  FINANCE_ADMIN: [
    "command_center",
    "payments",
    "payment_intelligence",
    "orders",
    "deposit_balances",
    "duty",
    "duty_intelligence",
    "receipts",
    "receipt_templates",
    "disputes",
    "currency",
  ],
};

export const ROLE_JOB_SUMMARY: Record<RbacUserRole, string> = {
  CUSTOMER: "Storefront shopper. Personal dashboard only. No admin console.",
  SERVICE_ASSISTANT: "Front-line support. Live chat, inquiries, and Ghana Card queue only.",
  SALES_ADMIN: "Sales floor. Inventory, leads, quotes, estimates, and customer orders.",
  SOURCING_MANAGER: "Supply. Parts catalog, Parts Finder, verified requests, and sourcing estimates.",
  LOGISTICS_MANAGER: "Fulfillment. Shipping, order movement, deposits, and duty tracking.",
  FINANCE_ADMIN: "Money. Payments, receipts, disputes, duty intelligence, and FX rates.",
  SUPER_ADMIN: "Full platform control. Every admin page, role access editor, and system settings.",
};

/** Account (dashboard) surfaces — what each role should use personally. */
export const ROLE_ACCOUNT_ACCESS: Record<
  RbacUserRole,
  { granted: string[]; denied: string[] }
> = {
  CUSTOMER: {
    granted: [
      "Overview, profile, notifications",
      "Favorites & cart, orders, payments",
      "Shipping tracking, duty estimates",
      "Parts Finder, inquiries & requests",
    ],
    denied: ["Admin / operations console", "Staff inboxes and role tools"],
  },
  SERVICE_ASSISTANT: {
    granted: [
      "Personal dashboard (same customer tools for your own account)",
      "Support inbox: Live Support Chat, inquiries, Ghana Card",
    ],
    denied: ["Inventory, payments, settings, user role changes", "Finance and logistics ops pages"],
  },
  SALES_ADMIN: {
    granted: [
      "Personal dashboard",
      "Sales ops: cars/bikes/parts, leads, quotes, estimates, orders, reviews",
    ],
    denied: ["System settings, user directory, audit/security", "Payment provider config"],
  },
  SOURCING_MANAGER: {
    granted: [
      "Personal dashboard",
      "Sourcing ops: parts, Parts Finder, verified parts, requests, estimates",
    ],
    denied: ["User directory, API settings, payment providers", "Full finance reconciliation tools"],
  },
  LOGISTICS_MANAGER: {
    granted: [
      "Personal dashboard",
      "Logistics ops: shipping, orders, deposit balances, duty tracking",
    ],
    denied: ["Inventory create/edit beyond order flow", "User roles, API settings, payment providers"],
  },
  FINANCE_ADMIN: {
    granted: [
      "Personal dashboard",
      "Finance ops: payments, receipts, disputes, duty intelligence, FX",
    ],
    denied: ["User directory, API environment settings", "Support inbox as primary (unless granted)"],
  },
  SUPER_ADMIN: {
    granted: ["Everything. Admin console, role access editor, settings, and personal dashboard"],
    denied: ["Nothing within the product (by design)"],
  },
};

export function isEditableStaffRole(role: string | null | undefined): role is EditableStaffRole {
  return EDITABLE_STAFF_ROLES.includes(role as EditableStaffRole);
}

export function defaultAdminPageKeysForRole(role: string | null | undefined): AdminPageKey[] {
  if (role === "SUPER_ADMIN") return [...ALL_ADMIN_PAGE_KEYS];
  if (isEditableStaffRole(role)) return [...DEFAULT_ROLE_ADMIN_PAGES[role]];
  return [];
}
