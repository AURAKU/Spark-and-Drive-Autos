import type { PartOrigin } from "@prisma/client";

/** Customer-facing inventory class. Database origin stays GHANA or CHINA. */
export type PublicStockClass = "GHANA" | "OVERSEAS";

export type PublicStockFilter = "all" | "ghana" | "overseas";

export function publicStockClass(origin: PartOrigin | "GHANA" | "CHINA"): PublicStockClass {
  return origin === "GHANA" ? "GHANA" : "OVERSEAS";
}

export function publicStockLabel(origin: PartOrigin | "GHANA" | "CHINA"): "Ghana Stock" | "Overseas Stock" {
  return publicStockClass(origin) === "GHANA" ? "Ghana Stock" : "Overseas Stock";
}

export function publicStockHint(origin: PartOrigin | "GHANA" | "CHINA"): string {
  return origin === "GHANA" ? "Available in Ghana" : "International fulfillment";
}

/**
 * Accepts the new `stock` query and the legacy `origin=GHANA|CHINA` query.
 * `china` maps to overseas. It is not a public label.
 */
export function parsePublicStockFilter(stock: string | undefined, legacyOrigin?: string): PublicStockFilter {
  const value = (stock ?? "").trim().toLowerCase();
  if (value === "all") return "all";
  if (value === "ghana" || value === "gh") return "ghana";
  if (value === "overseas" || value === "china") return "overseas";
  const origin = (legacyOrigin ?? "").trim().toUpperCase();
  if (!value) {
    if (origin === "GHANA") return "ghana";
    if (origin === "CHINA") return "overseas";
  }
  return "all";
}

export function stockFilterToOrigin(filter: PublicStockFilter): PartOrigin | undefined {
  if (filter === "ghana") return "GHANA";
  if (filter === "overseas") return "CHINA";
  return undefined;
}
