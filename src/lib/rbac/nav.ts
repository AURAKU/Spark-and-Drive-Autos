import type { AdminNavLink } from "@/components/layout/admin-mobile-nav";
import { ADMIN_PAGE_CATALOG, type AdminPageKey } from "@/lib/rbac/catalog";

/** Canonical sidebar order — only entries the role is granted appear. */
const NAV_ORDER: { key: AdminPageKey; label?: string }[] = [
  { key: "command_center", label: "Command Center" },
  { key: "roles", label: "Role access" },
  { key: "users", label: "All Users" },
  { key: "cars" },
  { key: "motorcycles" },
  { key: "parts" },
  { key: "parts_finder" },
  { key: "parts_request_fee" },
  { key: "verified_parts", label: "Verified parts" },
  { key: "requests", label: "Requests" },
  { key: "orders" },
  { key: "order_inquiries", label: "Order inquiries" },
  { key: "deposit_balances" },
  { key: "payments", label: "Payments" },
  { key: "payment_intelligence" },
  { key: "shipping", label: "Shipping & Delivery Tracking" },
  { key: "duty" },
  { key: "duty_estimator", label: "Duty estimator" },
  { key: "duty_intelligence" },
  { key: "estimates", label: "Import estimates" },
  { key: "leads", label: "Leads" },
  { key: "quotes", label: "Quotes" },
  { key: "inquiries", label: "Inquiries" },
  { key: "comms" },
  { key: "chats", label: "Chats" },
  { key: "reviews" },
  { key: "duplicates" },
  { key: "ghana_card", label: "Ghana Card" },
  { key: "verifications", label: "Verifications" },
  { key: "receipts", label: "Receipts" },
  { key: "receipt_templates" },
  { key: "disputes" },
  { key: "currency" },
  { key: "legal" },
  { key: "security" },
  { key: "import_export" },
  { key: "audit" },
  { key: "health" },
  { key: "settings" },
];

const byKey = new Map(ADMIN_PAGE_CATALOG.map((p) => [p.key, p]));

export function buildAdminNavLinks(pageKeys: readonly string[]): AdminNavLink[] {
  const allowed = new Set(pageKeys.includes("*") ? ADMIN_PAGE_CATALOG.map((p) => p.key) : pageKeys);
  const links: AdminNavLink[] = [];
  for (const item of NAV_ORDER) {
    if (!allowed.has(item.key)) continue;
    const def = byKey.get(item.key);
    if (!def) continue;
    links.push({ href: def.href, label: item.label ?? def.label });
  }
  return links;
}
