import { revalidateTag } from "next/cache";

export const OPS_ROUTE_CACHE_TAGS = {
  adminPaymentsIntelligence: "ops:admin-payments-intelligence",
  adminOrders: "ops:admin-orders",
  dashboardOrders: "ops:dashboard-orders",
  dashboardPayments: "ops:dashboard-payments",
} as const;

/**
 * Invalidates short-lived route query caches for heavy authenticated pages.
 * This is intentionally broad so repeated staff navigation gets fresh reads quickly after writes.
 */
export function invalidateOpsRouteCacheTags() {
  revalidateTag(OPS_ROUTE_CACHE_TAGS.adminPaymentsIntelligence);
  revalidateTag(OPS_ROUTE_CACHE_TAGS.adminOrders);
  revalidateTag(OPS_ROUTE_CACHE_TAGS.dashboardOrders);
  revalidateTag(OPS_ROUTE_CACHE_TAGS.dashboardPayments);
}
