import type { Car, OrderKind, PartOrderItem } from "@prisma/client";

type OrderRow = {
  kind: OrderKind;
  car: Car | null;
  partItems: PartOrderItem[];
};

/** Single-line summary for admin order lists (multi-item orders abbreviated). */
export function orderItemTitleSummary(o: OrderRow): string {
  if (o.kind === "CAR") {
    return o.car?.title?.trim() || "—";
  }
  const items = o.partItems;
  if (items.length === 0) return "—";
  if (items.length === 1) return items[0]!.titleSnapshot.trim() || "—";
  const first = items[0]!.titleSnapshot.trim() || "Item";
  return `${first} +${items.length - 1} more`;
}
