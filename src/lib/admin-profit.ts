/** Profit in RMB: selling (RMB) − cost (RMB). */
export function profitAmountRmb(basePriceRmb: number, supplierCostRmb: number | null | undefined): number | null {
  if (supplierCostRmb == null || !Number.isFinite(supplierCostRmb)) return null;
  return basePriceRmb - supplierCostRmb;
}

/** Margin % on selling price: ((sell − cost) / sell) × 100. Null if no cost or sell ≤ 0. */
export function profitMarginPercent(basePriceRmb: number, supplierCostRmb: number | null | undefined): number | null {
  if (basePriceRmb <= 0) return null;
  const profit = profitAmountRmb(basePriceRmb, supplierCostRmb);
  if (profit == null) return null;
  return (profit / basePriceRmb) * 100;
}
