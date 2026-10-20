import type { AdminPageKey } from "@/lib/rbac/catalog";

export type AdminHubId =
  | "command"
  | "people"
  | "vehicles"
  | "parts"
  | "parts_finder"
  | "sales"
  | "orders"
  | "money"
  | "shipping"
  | "duty"
  | "support"
  | "identity"
  | "system";

export type AdminHubDef = {
  id: AdminHubId;
  label: string;
  /** Primary sidebar href (hub landing). */
  href: string;
  description: string;
  /** RBAC page keys that unlock this hub in the sidebar. */
  pageKeys: AdminPageKey[];
  /** Paths that keep this hub highlighted in the nav. */
  matchPrefixes: string[];
  tabs: { id: string; label: string; href: string; pageKeys: AdminPageKey[] }[];
};

/**
 * Compact admin navigation: one sidebar entry per hub; related tools live in hub tabs.
 */
export const ADMIN_NAV_HUBS: readonly AdminHubDef[] = [
  {
    id: "command",
    label: "Command Center",
    href: "/admin",
    description: "Ops overview and quick actions.",
    pageKeys: ["command_center"],
    matchPrefixes: ["/admin"],
    tabs: [{ id: "overview", label: "Overview", href: "/admin", pageKeys: ["command_center"] }],
  },
  {
    id: "people",
    label: "People",
    href: "/admin/users",
    description: "Users, roles, and access.",
    pageKeys: ["users", "roles"],
    matchPrefixes: ["/admin/users", "/admin/roles"],
    tabs: [
      { id: "directory", label: "Directory", href: "/admin/users", pageKeys: ["users"] },
      { id: "roles", label: "Role reference", href: "/admin/users?panel=roles", pageKeys: ["users", "roles"] },
      { id: "access", label: "Edit access", href: "/admin/roles", pageKeys: ["roles"] },
    ],
  },
  {
    id: "vehicles",
    label: "Vehicles",
    href: "/admin/cars",
    description: "Cars, motorcycles, and duplicate checks.",
    pageKeys: ["cars", "motorcycles", "duplicates", "import_export"],
    matchPrefixes: ["/admin/cars", "/admin/motorcycles", "/admin/duplicates", "/admin/import-export"],
    tabs: [
      { id: "cars", label: "Cars", href: "/admin/cars", pageKeys: ["cars"] },
      { id: "motorcycles", label: "Motorcycles", href: "/admin/motorcycles", pageKeys: ["motorcycles"] },
      { id: "duplicates", label: "Duplicates", href: "/admin/duplicates", pageKeys: ["duplicates"] },
      { id: "bulk", label: "Bulk import/export", href: "/admin/import-export", pageKeys: ["import_export"] },
    ],
  },
  {
    id: "parts",
    label: "Parts catalog",
    href: "/admin/parts",
    description: "Parts inventory and categories.",
    pageKeys: ["parts"],
    matchPrefixes: ["/admin/parts"],
    tabs: [{ id: "catalog", label: "Catalog", href: "/admin/parts", pageKeys: ["parts"] }],
  },
  {
    id: "parts_finder",
    label: "Parts Finder",
    href: "/admin/parts-finder",
    description: "Finder sessions, verified parts, and request fees.",
    pageKeys: ["parts_finder", "parts_request_fee", "verified_parts"],
    matchPrefixes: ["/admin/parts-finder", "/admin/verified-parts"],
    tabs: [
      { id: "overview", label: "Overview", href: "/admin/parts-finder", pageKeys: ["parts_finder"] },
      {
        id: "verified",
        label: "Verified parts",
        href: "/admin/parts-finder?view=verified-parts",
        pageKeys: ["verified_parts", "parts_finder"],
      },
      {
        id: "fee",
        label: "Request fee",
        href: "/admin/parts-finder/parts-request-fee",
        pageKeys: ["parts_request_fee", "parts_finder"],
      },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    href: "/admin/leads",
    description: "Leads, quotes, estimates, requests, and reviews.",
    pageKeys: ["leads", "quotes", "estimates", "requests", "reviews"],
    matchPrefixes: ["/admin/leads", "/admin/quotes", "/admin/estimates", "/admin/requests", "/admin/reviews"],
    tabs: [
      { id: "leads", label: "Leads", href: "/admin/leads", pageKeys: ["leads"] },
      { id: "quotes", label: "Quotes", href: "/admin/quotes", pageKeys: ["quotes"] },
      { id: "estimates", label: "Import estimates", href: "/admin/estimates", pageKeys: ["estimates"] },
      { id: "requests", label: "Requests", href: "/admin/requests", pageKeys: ["requests"] },
      { id: "reviews", label: "Reviews", href: "/admin/reviews", pageKeys: ["reviews"] },
    ],
  },
  {
    id: "orders",
    label: "Orders",
    href: "/admin/orders",
    description: "Orders, inquiries, and deposit balances.",
    pageKeys: ["orders", "order_inquiries", "deposit_balances"],
    matchPrefixes: ["/admin/orders", "/admin/order-inquiries", "/admin/deposit-balances"],
    tabs: [
      { id: "orders", label: "All orders", href: "/admin/orders", pageKeys: ["orders"] },
      { id: "inquiries", label: "Order inquiries", href: "/admin/order-inquiries", pageKeys: ["order_inquiries"] },
      { id: "deposits", label: "Deposit balances", href: "/admin/deposit-balances", pageKeys: ["deposit_balances"] },
    ],
  },
  {
    id: "money",
    label: "Money",
    href: "/admin/payments/intelligence",
    description: "Payments, receipts, disputes, and FX.",
    pageKeys: ["payments", "payment_intelligence", "receipts", "receipt_templates", "disputes", "currency"],
    matchPrefixes: [
      "/admin/payments",
      "/admin/receipts",
      "/admin/disputes",
      "/admin/settings/currency",
      "/admin/settings/receipt-template",
    ],
    tabs: [
      {
        id: "payments",
        label: "Payment intelligence",
        href: "/admin/payments/intelligence",
        pageKeys: ["payment_intelligence", "payments"],
      },
      { id: "receipts", label: "Receipts", href: "/admin/receipts", pageKeys: ["receipts"] },
      {
        id: "templates",
        label: "Receipt templates",
        href: "/admin/receipts?tab=templates",
        pageKeys: ["receipt_templates", "receipts"],
      },
      { id: "disputes", label: "Disputes", href: "/admin/disputes", pageKeys: ["disputes"] },
      { id: "currency", label: "Exchange rates", href: "/admin/settings/currency", pageKeys: ["currency"] },
    ],
  },
  {
    id: "shipping",
    label: "Shipping",
    href: "/admin/shipping",
    description: "Shipments and delivery tracking.",
    pageKeys: ["shipping"],
    matchPrefixes: ["/admin/shipping"],
    tabs: [{ id: "tracking", label: "Tracking", href: "/admin/shipping", pageKeys: ["shipping"] }],
  },
  {
    id: "duty",
    label: "Duty",
    href: "/admin/duty",
    description: "Duty tracking, estimator, and intelligence.",
    pageKeys: ["duty", "duty_estimator", "duty_intelligence"],
    matchPrefixes: ["/admin/duty", "/admin/duty-estimator", "/admin/duty-intelligence"],
    tabs: [
      { id: "tracking", label: "Tracking", href: "/admin/duty", pageKeys: ["duty"] },
      { id: "estimator", label: "Estimator", href: "/admin/duty-estimator", pageKeys: ["duty_estimator"] },
      {
        id: "intelligence",
        label: "Intelligence",
        href: "/admin/duty-intelligence",
        pageKeys: ["duty_intelligence"],
      },
    ],
  },
  {
    id: "support",
    label: "Support",
    href: "/admin/comms",
    description: "Live chat and customer inquiries.",
    pageKeys: ["comms", "chats", "inquiries"],
    matchPrefixes: ["/admin/comms", "/admin/chats", "/admin/inquiries"],
    tabs: [
      { id: "comms", label: "Live chat", href: "/admin/comms", pageKeys: ["comms"] },
      { id: "chats", label: "Chat threads", href: "/admin/chats", pageKeys: ["chats"] },
      { id: "inquiries", label: "Inquiries", href: "/admin/inquiries", pageKeys: ["inquiries"] },
    ],
  },
  {
    id: "identity",
    label: "Identity",
    href: "/admin/identity",
    description: "Ghana Card and document verification.",
    pageKeys: ["ghana_card", "verifications"],
    matchPrefixes: ["/admin/identity", "/admin/ghana-card", "/admin/verifications"],
    tabs: [
      { id: "ghana-card", label: "Ghana Card", href: "/admin/identity?tab=ghana-card", pageKeys: ["ghana_card"] },
      {
        id: "documents",
        label: "Document checks",
        href: "/admin/identity?tab=documents",
        pageKeys: ["verifications"],
      },
    ],
  },
  {
    id: "system",
    label: "System",
    href: "/admin/settings",
    description: "Providers, legal, security, audit, and health.",
    pageKeys: ["settings", "legal", "security", "audit", "health"],
    matchPrefixes: ["/admin/settings", "/admin/legal", "/admin/security", "/admin/audit", "/admin/health"],
    tabs: [
      { id: "providers", label: "API & providers", href: "/admin/settings", pageKeys: ["settings"] },
      { id: "legal", label: "Legal", href: "/admin/legal", pageKeys: ["legal"] },
      { id: "security", label: "Security", href: "/admin/security", pageKeys: ["security"] },
      { id: "audit", label: "Audit", href: "/admin/audit", pageKeys: ["audit"] },
      { id: "health", label: "Health", href: "/admin/health", pageKeys: ["health"] },
    ],
  },
];

export function hubVisibleForKeys(hub: AdminHubDef, allowed: Set<string>): boolean {
  if (allowed.has("*")) return true;
  return hub.pageKeys.some((k) => allowed.has(k));
}

export function filterHubTabs(hub: AdminHubDef, allowed: Set<string>) {
  if (allowed.has("*")) return hub.tabs;
  return hub.tabs.filter((t) => t.pageKeys.some((k) => allowed.has(k)));
}

/** Exact /admin is Command Center only; longer prefixes win for other hubs. */
export function resolveAdminHubId(pathname: string): AdminHubId | null {
  const path = pathname.replace(/\/$/, "") || "/admin";
  if (path === "/admin") return "command";

  let best: { id: AdminHubId; len: number } | null = null;
  for (const hub of ADMIN_NAV_HUBS) {
    if (hub.id === "command") continue;
    for (const prefix of hub.matchPrefixes) {
      const base = prefix.replace(/\/$/, "");
      if (path === base || path.startsWith(`${base}/`) || (base.includes("?") === false && path.startsWith(base))) {
        // Prefer more specific prefixes (e.g. /admin/parts-finder over /admin/parts)
        if (!best || base.length > best.len) {
          best = { id: hub.id, len: base.length };
        }
      }
    }
  }
  return best?.id ?? null;
}

export function getAdminHub(id: AdminHubId): AdminHubDef | undefined {
  return ADMIN_NAV_HUBS.find((h) => h.id === id);
}
