import type { OrderKind } from "@prisma/client";

import { type FxRatesInput, convertRmbTo } from "@/lib/currency";

/** Normalize payment/order amounts to GHS using global FX (admin settings). */
export function amountToGhs(amount: number, currency: string | null | undefined, fx: FxRatesInput): number {
  const c = (currency ?? "GHS").toUpperCase();
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  if (c === "GHS") return Math.round(n);
  if (c === "USD") {
    const u = Number(fx.usdToGhs);
    return Number.isFinite(u) && u > 0 ? Math.round(n * u) : Math.round(n * 11.65);
  }
  if (c === "CNY" || c === "RMB") {
    const d = Number(fx.rmbToGhs);
    return Number.isFinite(d) && d > 0 ? Math.round(n / d) : Math.round(n / 0.586);
  }
  return Math.round(n);
}

type OrderForCogs = {
  kind: OrderKind;
  car: { supplierCostRmb: unknown } | null;
  partItems: Array<{ quantity: number; part: { supplierCostRmb: unknown } | null }>;
};

/** Full-order inventory COGS in GHS from Cars (supplier RMB) or Parts lines (supplier RMB × qty). */
export function orderInventoryCogsGhs(order: OrderForCogs, fx: FxRatesInput): { cogsGhs: number; missingCost: boolean } {
  if (order.kind === "CAR") {
    if (!order.car) return { cogsGhs: 0, missingCost: true };
    const rmb = Number(order.car.supplierCostRmb ?? 0);
    const missing = !Number.isFinite(rmb) || rmb <= 0;
    return { cogsGhs: convertRmbTo(rmb, "GHS", fx), missingCost: missing };
  }
  if (order.kind === "PARTS") {
    let sumRmb = 0;
    let missing = false;
    for (const line of order.partItems) {
      const unit = Number(line.part?.supplierCostRmb ?? 0);
      if (!Number.isFinite(unit) || unit <= 0) missing = true;
      sumRmb += (Number.isFinite(unit) ? unit : 0) * line.quantity;
    }
    if (order.partItems.length === 0) missing = true;
    return { cogsGhs: convertRmbTo(sumRmb, "GHS", fx), missingCost: missing };
  }
  return { cogsGhs: 0, missingCost: true };
}

export function sumInventoryProfitForSuccessPayments(
  payments: Array<{
    amount: unknown;
    currency: string;
    order: (OrderForCogs & { amount: unknown; currency: string }) | null;
  }>,
  fx: FxRatesInput,
): {
  revenueGhs: number;
  cogsGhs: number;
  profitGhs: number;
  ordersAttributed: number;
  ordersWithMissingCost: number;
} {
  let revenueGhs = 0;
  let cogsGhs = 0;
  let ordersAttributed = 0;
  let ordersWithMissingCost = 0;

  for (const p of payments) {
    if (!p.order) continue;
    ordersAttributed++;
    const payGhs = amountToGhs(Number(p.amount), p.currency, fx);
    const ordGhs = amountToGhs(Number(p.order.amount), p.order.currency, fx);
    const { cogsGhs: fullCogs, missingCost } = orderInventoryCogsGhs(p.order, fx);
    if (missingCost) ordersWithMissingCost++;
    const ratio = ordGhs > 0 ? Math.min(1, Math.max(0, payGhs / ordGhs)) : 1;
    const alloc = Math.round(fullCogs * ratio);
    revenueGhs += payGhs;
    cogsGhs += alloc;
  }

  return {
    revenueGhs,
    cogsGhs,
    profitGhs: revenueGhs - cogsGhs,
    ordersAttributed,
    ordersWithMissingCost,
  };
}

type ProfitSplitBucket = {
  revenueGhs: number;
  cogsGhs: number;
  profitGhs: number;
  paymentsAttributed: number;
  paymentsWithMissingCost: number;
};

/** Same allocation rules as `sumInventoryProfitForSuccessPayments`, split by `order.kind`. */
export function splitInventoryProfitForSuccessPayments(
  payments: Array<{
    amount: unknown;
    currency: string;
    order: (OrderForCogs & { amount: unknown; currency: string }) | null;
  }>,
  fx: FxRatesInput,
): { car: ProfitSplitBucket; parts: ProfitSplitBucket } {
  const empty = (): ProfitSplitBucket => ({
    revenueGhs: 0,
    cogsGhs: 0,
    profitGhs: 0,
    paymentsAttributed: 0,
    paymentsWithMissingCost: 0,
  });
  const car = empty();
  const parts = empty();

  for (const p of payments) {
    if (!p.order) continue;
    const bucket = p.order.kind === "CAR" ? car : parts;
    bucket.paymentsAttributed++;
    const payGhs = amountToGhs(Number(p.amount), p.currency, fx);
    const ordGhs = amountToGhs(Number(p.order.amount), p.order.currency, fx);
    const { cogsGhs: fullCogs, missingCost } = orderInventoryCogsGhs(p.order, fx);
    if (missingCost) bucket.paymentsWithMissingCost++;
    const ratio = ordGhs > 0 ? Math.min(1, Math.max(0, payGhs / ordGhs)) : 1;
    const alloc = Math.round(fullCogs * ratio);
    bucket.revenueGhs += payGhs;
    bucket.cogsGhs += alloc;
  }

  car.profitGhs = car.revenueGhs - car.cogsGhs;
  parts.profitGhs = parts.revenueGhs - parts.cogsGhs;
  return { car, parts };
}
