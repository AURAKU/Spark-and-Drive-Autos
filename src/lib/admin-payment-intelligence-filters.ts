import type { OrderKind, Prisma } from "@prisma/client";
import type { PaymentSettlementMethod, PaymentStatus } from "@prisma/client";

import { parseOpsDateFromSearchParams } from "@/lib/admin-operations-date-filter";
import { SETTLEMENT_METHOD_ORDER } from "@/lib/payment-settlement";
import { PAYMENT_STATUS_ORDER } from "@/lib/payment-status-utils";

export type PaymentIntelPeriod = "7d" | "30d" | "90d" | "all";

function getPeriodStart(period: PaymentIntelPeriod): Date | undefined {
  if (period === "all") return undefined;
  const now = new Date();
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function buildPaymentIntelligenceFilters(sp: Record<string, string | string[] | undefined>): {
  methodFilter: PaymentSettlementMethod | undefined;
  statusFilter: PaymentStatus | undefined;
  orderKindFilter: OrderKind | undefined;
  q: string;
  period: PaymentIntelPeriod;
  ops: ReturnType<typeof parseOpsDateFromSearchParams>;
  paymentCreatedFilter: { gte: Date; lt: Date } | { gte: Date } | undefined;
  basePaymentWhere: Prisma.PaymentWhereInput;
  /** Same as `basePaymentWhere` but without `order.kind` — use for revenue that has no order (e.g. Parts Finder activation). */
  basePaymentWhereSansOrderKind: Prisma.PaymentWhereInput;
  walletWhere: Prisma.WalletTransactionWhereInput;
} {
  const methodParam = typeof sp.method === "string" ? sp.method : "";
  const statusParam = typeof sp.status === "string" ? sp.status : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const periodParam = (typeof sp.period === "string" ? sp.period : "30d") as PaymentIntelPeriod;
  const period: PaymentIntelPeriod = ["7d", "30d", "90d", "all"].includes(periodParam) ? periodParam : "30d";
  const since = getPeriodStart(period);
  const ops = parseOpsDateFromSearchParams(sp);
  const paymentCreatedFilter =
    ops.range != null
      ? { gte: ops.range.gte, lt: ops.range.lt }
      : since != null
        ? { gte: since }
        : undefined;

  const methodFilter = SETTLEMENT_METHOD_ORDER.includes(methodParam as PaymentSettlementMethod)
    ? (methodParam as PaymentSettlementMethod)
    : undefined;
  const statusFilter = PAYMENT_STATUS_ORDER.includes(statusParam as PaymentStatus)
    ? (statusParam as PaymentStatus)
    : undefined;

  const orderKindRaw = typeof sp.orderKind === "string" ? sp.orderKind : "";
  const orderKindFilter: OrderKind | undefined =
    orderKindRaw === "CAR" || orderKindRaw === "PARTS" ? (orderKindRaw as OrderKind) : undefined;

  const searchablePaymentWhere: Prisma.PaymentWhereInput = q
    ? {
        OR: [
          { providerReference: { contains: q, mode: "insensitive" } },
          { id: { contains: q, mode: "insensitive" } },
          { user: { is: { email: { contains: q, mode: "insensitive" } } } },
          { order: { is: { reference: { contains: q, mode: "insensitive" } } } },
        ],
      }
    : {};

  const basePaymentWhereSansOrderKind: Prisma.PaymentWhereInput = {
    ...(methodFilter ? { settlementMethod: methodFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(paymentCreatedFilter ? { createdAt: paymentCreatedFilter } : {}),
    ...searchablePaymentWhere,
  };

  const basePaymentWhere: Prisma.PaymentWhereInput = {
    ...basePaymentWhereSansOrderKind,
    ...(orderKindFilter ? { order: { is: { kind: orderKindFilter } } } : {}),
  };

  const walletSearchWhere: Prisma.WalletTransactionWhereInput = q
    ? {
        OR: [
          { reference: { contains: q, mode: "insensitive" } },
          { user: { is: { email: { contains: q, mode: "insensitive" } } } },
          { order: { is: { reference: { contains: q, mode: "insensitive" } } } },
        ],
      }
    : {};

  const walletOrderKindWhere: Prisma.WalletTransactionWhereInput | undefined = orderKindFilter
    ? {
        OR: [{ orderId: null }, { order: { is: { kind: orderKindFilter } } }],
      }
    : undefined;

  const walletAnd: Prisma.WalletTransactionWhereInput[] = [];
  if (paymentCreatedFilter) walletAnd.push({ createdAt: paymentCreatedFilter });
  if (walletOrderKindWhere) walletAnd.push(walletOrderKindWhere);
  if (q) walletAnd.push(walletSearchWhere);

  const walletWhere: Prisma.WalletTransactionWhereInput =
    walletAnd.length > 1 ? { AND: walletAnd } : walletAnd.length === 1 ? walletAnd[0]! : {};

  return {
    methodFilter,
    statusFilter,
    orderKindFilter,
    q,
    period,
    ops,
    paymentCreatedFilter,
    basePaymentWhere,
    basePaymentWhereSansOrderKind,
    walletWhere,
  };
}
