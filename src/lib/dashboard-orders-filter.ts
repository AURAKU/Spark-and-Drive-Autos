import type { Prisma } from "@prisma/client";
import { SourceType } from "@prisma/client";

import { wherePartsLineageForAdminList } from "@/lib/admin-orders-parts-filter";

export type DashboardOrderFilterId =
  | "all"
  | "parts-ghana"
  | "parts-china-preorder"
  | "car-ghana"
  | "car-china";

const ALLOWED: readonly DashboardOrderFilterId[] = [
  "all",
  "parts-ghana",
  "parts-china-preorder",
  "car-ghana",
  "car-china",
] as const;

export function parseDashboardOrderFilter(raw: string | string[] | undefined): DashboardOrderFilterId {
  const s = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  if (s && (ALLOWED as readonly string[]).includes(s)) return s as DashboardOrderFilterId;
  return "all";
}

export function whereForDashboardOrderFilter(
  userId: string,
  filter: DashboardOrderFilterId,
): Prisma.OrderWhereInput {
  const base: Prisma.OrderWhereInput = { userId };
  if (filter === "all") return base;

  if (filter === "parts-ghana") {
    const w = wherePartsLineageForAdminList("ghana");
    return w ? { AND: [base, w] } : base;
  }
  if (filter === "parts-china-preorder") {
    const w = wherePartsLineageForAdminList("china_preorder");
    return w ? { AND: [base, w] } : base;
  }
  if (filter === "car-ghana") {
    return {
      ...base,
      kind: "CAR",
      car: { sourceType: SourceType.IN_GHANA },
    };
  }
  if (filter === "car-china") {
    return {
      ...base,
      kind: "CAR",
      car: { sourceType: SourceType.IN_CHINA },
    };
  }
  return base;
}

export function ordersListHref(page: number, filter: DashboardOrderFilterId): string {
  const p = new URLSearchParams();
  if (filter !== "all") p.set("filter", filter);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  return qs ? `/dashboard/orders?${qs}` : "/dashboard/orders";
}
