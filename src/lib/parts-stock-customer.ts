/** Customer-facing copy for parts / accessories stock limits (cart, checkout, buy-now). */

export function partOutOfStockCustomerMessage(partTitle: string): string {
  return `Dear customer, "${partTitle}" is completely out of stock and cannot be added to your order right now. Please contact customer support for restock timing or a suitable alternative.`;
}

export function partQuantityExceedsStockMessage(partTitle: string, requested: number, available: number): string {
  return `Dear customer, you selected ${requested} of "${partTitle}" but only ${available} ${available === 1 ? "unit is" : "units are"} available. Please reduce the quantity to ${available} or less to continue.`;
}

export type PartsStockErrorCode = "OUT_OF_STOCK" | "INSUFFICIENT_STOCK";

export class PartsStockError extends Error {
  constructor(
    message: string,
    public readonly code: PartsStockErrorCode,
    public readonly partTitle: string,
    public readonly availableQty: number,
    public readonly requestedQty: number,
  ) {
    super(message);
    this.name = "PartsStockError";
  }
}

export function isPartsStockError(e: unknown): e is PartsStockError {
  return e instanceof PartsStockError;
}
