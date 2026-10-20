/**
 * Admin page catalog + path matching. Edge-safe (no Prisma / Node APIs).
 * Keys are stored on RoleAccessOverride and JWTs.
 */

export const EDITABLE_STAFF_ROLES = [
  "SERVICE_ASSISTANT",
  "SALES_ADMIN",
  "SOURCING_MANAGER",
  "LOGISTICS_MANAGER",
  "FINANCE_ADMIN",
] as const;

export type EditableStaffRole = (typeof EDITABLE_STAFF_ROLES)[number];

export type AdminPageKey =
  | "command_center"
  | "users"
  | "roles"
  | "cars"
  | "motorcycles"
  | "parts"
  | "parts_finder"
  | "parts_request_fee"
  | "orders"
  | "order_inquiries"
  | "deposit_balances"
  | "payments"
  | "payment_intelligence"
  | "shipping"
  | "duty"
  | "duty_estimator"
  | "duty_intelligence"
  | "security"
  | "currency"
  | "legal"
  | "disputes"
  | "comms"
  | "inquiries"
  | "leads"
  | "quotes"
  | "estimates"
  | "requests"
  | "reviews"
  | "receipts"
  | "receipt_templates"
  | "import_export"
  | "duplicates"
  | "audit"
  | "health"
  | "settings"
  | "ghana_card"
  | "verifications"
  | "verified_parts"
  | "chats";

export type AdminPageDef = {
  key: AdminPageKey;
  label: string;
  href: string;
  /** Job-area grouping for the access editor. */
  group: "core" | "inventory" | "sales" | "sourcing" | "logistics" | "finance" | "support" | "system";
  description: string;
  /** When true, only Super Admin may grant via UI (still listed for clarity). */
  superAdminLocked?: boolean;
};

/**
 * Longer / more specific prefixes must appear before shorter ones in matching.
 * `command_center` is exact `/admin` only.
 */
export const ADMIN_PAGE_CATALOG: readonly AdminPageDef[] = [
  {
    key: "command_center",
    label: "Command Center",
    href: "/admin",
    group: "core",
    description: "Operations home / overview.",
  },
  {
    key: "roles",
    label: "Role access",
    href: "/admin/roles",
    group: "system",
    description: "Edit which admin pages each staff role can open.",
    superAdminLocked: true,
  },
  {
    key: "users",
    label: "All Users",
    href: "/admin/users",
    group: "system",
    description: "User directory, roles, suspend, wallet.",
    superAdminLocked: true,
  },
  {
    key: "cars",
    label: "Cars Inventory",
    href: "/admin/cars",
    group: "inventory",
    description: "Car listings and media.",
  },
  {
    key: "motorcycles",
    label: "Motorcycle Inventory",
    href: "/admin/motorcycles",
    group: "inventory",
    description: "Motorcycle listings and media.",
  },
  {
    key: "parts",
    label: "Parts Management",
    href: "/admin/parts",
    group: "inventory",
    description: "Parts catalog, stock, delivery options.",
  },
  {
    key: "parts_finder",
    label: "Parts Finder",
    href: "/admin/parts-finder",
    group: "sourcing",
    description: "Finder sessions, memberships, review queue.",
  },
  {
    key: "parts_request_fee",
    label: "Parts request fee",
    href: "/admin/parts-finder/parts-request-fee",
    group: "sourcing",
    description: "Paid autoparts request fee settings.",
  },
  {
    key: "verified_parts",
    label: "Verified parts",
    href: "/admin/verified-parts",
    group: "sourcing",
    description: "Verified part request workflow.",
  },
  {
    key: "requests",
    label: "Requests",
    href: "/admin/requests",
    group: "sourcing",
    description: "Sourcing / part requests queue.",
  },
  {
    key: "orders",
    label: "All Orders",
    href: "/admin/orders",
    group: "sales",
    description: "Order management and fulfillment status.",
  },
  {
    key: "order_inquiries",
    label: "Order inquiries",
    href: "/admin/order-inquiries",
    group: "support",
    description: "Customer questions on orders.",
  },
  {
    key: "deposit_balances",
    label: "Deposit balances",
    href: "/admin/deposit-balances",
    group: "finance",
    description: "Vehicle reservation deposit tracking.",
  },
  {
    key: "payments",
    label: "Payments",
    href: "/admin/payments",
    group: "finance",
    description: "Payment records and settlement.",
  },
  {
    key: "payment_intelligence",
    label: "Payment intelligence",
    href: "/admin/payments/intelligence",
    group: "finance",
    description: "Payment analytics and risk signals.",
  },
  {
    key: "shipping",
    label: "Shipping & Delivery",
    href: "/admin/shipping",
    group: "logistics",
    description: "Shipments, milestones, tracking.",
  },
  {
    key: "duty",
    label: "Duty Tracking",
    href: "/admin/duty",
    group: "logistics",
    description: "Duty records tied to imports.",
  },
  {
    key: "duty_estimator",
    label: "Duty estimator",
    href: "/admin/duty-estimator",
    group: "logistics",
    description: "Manual duty estimate tools.",
  },
  {
    key: "duty_intelligence",
    label: "Duty Intelligence",
    href: "/admin/duty-intelligence",
    group: "finance",
    description: "Duty calibration and intelligence engine.",
  },
  {
    key: "estimates",
    label: "Vehicle import estimates",
    href: "/admin/estimates",
    group: "sales",
    description: "Customer vehicle import estimate workflow.",
  },
  {
    key: "leads",
    label: "Leads",
    href: "/admin/leads",
    group: "sales",
    description: "Sales leads pipeline.",
  },
  {
    key: "quotes",
    label: "Quotes",
    href: "/admin/quotes",
    group: "sales",
    description: "Quotes for customers.",
  },
  {
    key: "inquiries",
    label: "Inquiries",
    href: "/admin/inquiries",
    group: "support",
    description: "General customer inquiries.",
  },
  {
    key: "comms",
    label: "Live Support Chat",
    href: "/admin/comms",
    group: "support",
    description: "Live messaging inbox.",
  },
  {
    key: "chats",
    label: "Chats",
    href: "/admin/chats",
    group: "support",
    description: "Chat thread admin views.",
  },
  {
    key: "reviews",
    label: "All Reviews",
    href: "/admin/reviews",
    group: "sales",
    description: "Moderate storefront reviews.",
  },
  {
    key: "duplicates",
    label: "Duplicate Inventory",
    href: "/admin/duplicates",
    group: "inventory",
    description: "Likely duplicate listings.",
  },
  {
    key: "import_export",
    label: "Bulk import & export",
    href: "/admin/import-export",
    group: "system",
    description: "Bulk inventory import/export.",
    superAdminLocked: true,
  },
  {
    key: "ghana_card",
    label: "Ghana Card",
    href: "/admin/identity?tab=ghana-card",
    group: "support",
    description: "Ghana Card review (Identity hub).",
  },
  {
    key: "verifications",
    label: "Document verification",
    href: "/admin/identity?tab=documents",
    group: "support",
    description: "ID document checks (Identity hub).",
  },
  {
    key: "receipts",
    label: "Receipts",
    href: "/admin/receipts",
    group: "finance",
    description: "Generated receipts.",
  },
  {
    key: "receipt_templates",
    label: "Receipt templates",
    href: "/admin/settings/receipt-template",
    group: "finance",
    description: "Receipt template configuration.",
  },
  {
    key: "disputes",
    label: "Disputes & Chargebacks",
    href: "/admin/disputes",
    group: "finance",
    description: "Payment disputes defense.",
  },
  {
    key: "currency",
    label: "Exchange Rates",
    href: "/admin/settings/currency",
    group: "finance",
    description: "FX rates used across the platform.",
  },
  {
    key: "legal",
    label: "Legal Controls",
    href: "/admin/legal",
    group: "system",
    description: "Policies, versions, enforcement.",
    superAdminLocked: true,
  },
  {
    key: "security",
    label: "Security Surveillance",
    href: "/admin/security",
    group: "system",
    description: "Security observations and alerts.",
    superAdminLocked: true,
  },
  {
    key: "audit",
    label: "Audit logs",
    href: "/admin/audit",
    group: "system",
    description: "Admin action audit trail.",
    superAdminLocked: true,
  },
  {
    key: "health",
    label: "System health",
    href: "/admin/health",
    group: "system",
    description: "Runtime health checks.",
    superAdminLocked: true,
  },
  {
    key: "settings",
    label: "API Providers & Environment",
    href: "/admin/settings",
    group: "system",
    description: "Payment providers and environment config.",
    superAdminLocked: true,
  },
] as const;

const BY_KEY = new Map(ADMIN_PAGE_CATALOG.map((p) => [p.key, p]));

export function getAdminPageDef(key: AdminPageKey): AdminPageDef | undefined {
  return BY_KEY.get(key);
}

/** Longest-prefix match so nested routes resolve to the right page key. */
export function resolveAdminPageKey(pathname: string): AdminPageKey | null {
  const path = pathname.replace(/\/$/, "") || "/admin";
  if (path === "/admin") return "command_center";

  let best: { key: AdminPageKey; len: number } | null = null;
  for (const page of ADMIN_PAGE_CATALOG) {
    if (page.key === "command_center") continue;
    const base = page.href.replace(/\/$/, "");
    if (path === base || path.startsWith(`${base}/`)) {
      if (!best || base.length > best.len) {
        best = { key: page.key, len: base.length };
      }
    }
  }
  return best?.key ?? null;
}

export function pathAllowedForPageKeys(pathname: string, keys: readonly string[]): boolean {
  if (keys.includes("*")) return true;
  const path = pathname.replace(/\/$/, "") || "/admin";
  // Merged Identity hub — open if the role has either Ghana Card or document verification.
  if (path === "/admin/identity" || path.startsWith("/admin/identity/")) {
    return keys.includes("ghana_card") || keys.includes("verifications");
  }
  const key = resolveAdminPageKey(pathname);
  if (!key) return false;
  return keys.includes(key);
}

export function firstAllowedAdminHref(keys: readonly string[]): string {
  if (keys.includes("*") || keys.includes("command_center")) return "/admin";
  for (const page of ADMIN_PAGE_CATALOG) {
    if (keys.includes(page.key)) return page.href;
  }
  return "/dashboard";
}

export const ADMIN_PAGE_GROUPS: { id: AdminPageDef["group"]; label: string }[] = [
  { id: "core", label: "Core" },
  { id: "inventory", label: "Inventory" },
  { id: "sales", label: "Sales" },
  { id: "sourcing", label: "Sourcing" },
  { id: "logistics", label: "Logistics" },
  { id: "finance", label: "Finance" },
  { id: "support", label: "Support" },
  { id: "system", label: "System" },
];
