import type { PartsFinderMembershipState } from "@/lib/parts-finder/search-types";

/**
 * Centralizes public entry routing so landing CTA behavior is deterministic and testable.
 */
export function resolvePartsFinderEntryDestination(
  state: PartsFinderMembershipState,
  callbackUrl = "/parts-finder/entry",
): string {
  if (state === "UPSELL_ONLY" || state === "UNAUTHENTICATED") {
    return `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  }
  if (state === "ACTIVE") return "/parts-finder/search";
  if (state === "EXPIRED") return "/parts-finder/activate?status=renew";
  if (state === "PENDING_APPROVAL") return "/parts-finder/activate?status=pending-payment";
  if (state === "PENDING_PAYMENT") return "/parts-finder/activate?status=pending-payment";
  if (state === "SUSPENDED") return "/parts-finder/activate?status=suspended";
  return "/parts-finder/activate";
}
