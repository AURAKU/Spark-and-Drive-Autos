import { PartStockStatus } from "@prisma/client";

/** Auto tier from quantity (does not produce ON_REQUEST — that stays manual / China pre-order). */
export function derivePartStockFromQty(qty: number): PartStockStatus {
  if (qty <= 0) return PartStockStatus.OUT_OF_STOCK;
  if (qty < 5) return PartStockStatus.LOW_STOCK;
  return PartStockStatus.IN_STOCK;
}

export function partStockStatusLabel(status: PartStockStatus): string {
  switch (status) {
    case PartStockStatus.IN_STOCK:
      return "In Stock in Ghana";
    case PartStockStatus.LOW_STOCK:
      return "Low Stock";
    case PartStockStatus.OUT_OF_STOCK:
      return "Out of Stock";
    case PartStockStatus.ON_REQUEST:
      return "Pre Order on Request";
    default:
      return String(status).replaceAll("_", " ");
  }
}
