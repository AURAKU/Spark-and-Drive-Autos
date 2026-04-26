import type { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";

import { OPS_ROUTE_CACHE_TAGS } from "@/lib/ops-route-cache-tags";
import { prisma } from "@/lib/prisma";

/** Page size for payment records, wallet ledger, and action queue on Payments Intelligence. */
export const INTEL_LIST_PAGE_SIZE = 15;

/** Normalize a 1-based page from URL/query (defaults to 1). */
export function normalizeIntelListPage(raw: number | undefined): number {
  if (raw == null || !Number.isFinite(raw)) return 1;
  const n = Math.floor(raw);
  if (n < 1) return 1;
  return Math.min(n, 999_999);
}

function clampPage(requested: number, totalItems: number, pageSize: number): number {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalItems) / pageSize));
  return Math.min(Math.max(1, requested), totalPages);
}

function attentionPaymentsWhere(basePaymentWhere: Prisma.PaymentWhereInput): Prisma.PaymentWhereInput {
  return {
    ...basePaymentWhere,
    OR: [{ status: "AWAITING_PROOF" }, { proofs: { some: { status: "PENDING" } } }, { status: "FAILED" }],
  };
}

/** Normalize Prisma Decimal / unknown numeric for dashboard math. */
export function decimalLikeToNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  if (value && typeof value === "object" && "toNumber" in (value as Record<string, unknown>)) {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export type PaymentIntelligenceListMeta = {
  paymentsPage: number;
  paymentsTotalPages: number;
  paymentsTotal: number;
  walletPage: number;
  walletTotalPages: number;
  walletTotal: number;
  actionPage: number;
  actionTotalPages: number;
  actionTotal: number;
  pageSize: number;
};

/**
 * Single entry point for Payments Intelligence dashboard queries.
 * Keeps Prisma shapes in one module so intelligence page, exports, and future combined ops UI stay aligned.
 */
export async function fetchPaymentIntelligenceAggregateData(params: {
  basePaymentWhere: Prisma.PaymentWhereInput;
  basePaymentWhereSansOrderKind: Prisma.PaymentWhereInput;
  walletWhere: Prisma.WalletTransactionWhereInput;
  paymentsPage?: number;
  walletPage?: number;
  actionPage?: number;
}) {
  const { basePaymentWhere, basePaymentWhereSansOrderKind, walletWhere } = params;
  const pageSize = INTEL_LIST_PAGE_SIZE;
  const requestedPay = normalizeIntelListPage(params.paymentsPage);
  const requestedWallet = normalizeIntelListPage(params.walletPage);
  const requestedAction = normalizeIntelListPage(params.actionPage);

  const attentionWhere = attentionPaymentsWhere(basePaymentWhere);

  const [
    byStatus,
    byMethod,
    pendingProofReview,
    awaitingProofNoUpload,
    walletRowsTotal,
    attentionTotal,
    walletCreditAgg,
    walletDebitAgg,
    walletPendingCount,
    partsSalesFromWalletAgg,
    profitPayments,
    partsFinderActivationPayments,
  ] = await Promise.all([
    prisma.payment.groupBy({ by: ["status"], where: basePaymentWhere, _count: { _all: true }, _sum: { amount: true } }),
    prisma.payment.groupBy({
      by: ["settlementMethod"],
      where: basePaymentWhere,
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.paymentProof.count({ where: { status: "PENDING" } }),
    prisma.payment.count({
      where: { ...basePaymentWhere, status: "AWAITING_PROOF", proofs: { none: {} } },
    }),
    prisma.walletTransaction.count({ where: walletWhere }),
    prisma.payment.count({ where: attentionWhere }),
    prisma.walletTransaction.aggregate({
      where: { ...walletWhere, direction: "CREDIT", status: "SUCCESS" },
      _sum: { amount: true },
    }),
    prisma.walletTransaction.aggregate({
      where: { ...walletWhere, direction: "DEBIT", status: "SUCCESS" },
      _sum: { amount: true },
    }),
    prisma.walletTransaction.count({ where: { ...walletWhere, status: "PENDING" } }),
    prisma.walletTransaction.aggregate({
      where: {
        ...walletWhere,
        direction: "DEBIT",
        purpose: "PARTS_PURCHASE",
        status: "SUCCESS",
      },
      _sum: { amount: true },
    }),
    prisma.payment.findMany({
      where: { ...basePaymentWhere, status: "SUCCESS", orderId: { not: null } },
      select: {
        amount: true,
        currency: true,
        order: {
          select: {
            amount: true,
            currency: true,
            kind: true,
            car: { select: { supplierCostRmb: true } },
            partItems: {
              select: {
                quantity: true,
                part: { select: { supplierCostRmb: true } },
              },
            },
          },
        },
      },
    }),
    prisma.payment.findMany({
      where: {
        ...basePaymentWhereSansOrderKind,
        status: "SUCCESS",
        paymentType: "PARTS_FINDER_MEMBERSHIP",
      },
      select: { amount: true, currency: true },
    }),
  ]);

  const statusMap = new Map(byStatus.map((r) => [r.status, r]));
  const totals = byStatus.reduce((sum, row) => sum + row._count._all, 0);
  const successCount = statusMap.get("SUCCESS")?._count._all ?? 0;
  const failedCount = statusMap.get("FAILED")?._count._all ?? 0;
  const pendingCount = statusMap.get("PENDING")?._count._all ?? 0;
  const disputedCount = statusMap.get("DISPUTED")?._count._all ?? 0;
  const awaitingProofCount = statusMap.get("AWAITING_PROOF")?._count._all ?? 0;
  const successValueAgg = { _sum: { amount: statusMap.get("SUCCESS")?._sum.amount ?? null } };
  const failedValueAgg = { _sum: { amount: statusMap.get("FAILED")?._sum.amount ?? null } };
  const refundedValueAgg = { _sum: { amount: statusMap.get("REFUNDED")?._sum.amount ?? null } };

  const paymentsPage = clampPage(requestedPay, totals, pageSize);
  const walletPage = clampPage(requestedWallet, walletRowsTotal, pageSize);
  const actionPage = clampPage(requestedAction, attentionTotal, pageSize);

  const [rows, walletRows, attention] = await Promise.all([
    prisma.payment.findMany({
      where: basePaymentWhere,
      orderBy: { createdAt: "desc" },
      skip: (paymentsPage - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        paymentType: true,
        settlementMethod: true,
        providerReference: true,
        orderId: true,
        updatedAt: true,
        user: { select: { email: true } },
        order: { select: { reference: true } },
      },
    }),
    prisma.walletTransaction.findMany({
      where: walletWhere,
      orderBy: { createdAt: "desc" },
      skip: (walletPage - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { email: true, name: true } }, order: { select: { reference: true } } },
    }),
    prisma.payment.findMany({
      where: attentionWhere,
      orderBy: { updatedAt: "desc" },
      skip: (actionPage - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { email: true, name: true } },
        order: { select: { reference: true } },
        proofs: { select: { id: true, status: true } },
      },
    }),
  ]);

  const listMeta: PaymentIntelligenceListMeta = {
    paymentsPage,
    paymentsTotalPages: Math.max(1, Math.ceil(Math.max(0, totals) / pageSize)),
    paymentsTotal: totals,
    walletPage,
    walletTotalPages: Math.max(1, Math.ceil(Math.max(0, walletRowsTotal) / pageSize)),
    walletTotal: walletRowsTotal,
    actionPage,
    actionTotalPages: Math.max(1, Math.ceil(Math.max(0, attentionTotal) / pageSize)),
    actionTotal: attentionTotal,
    pageSize,
  };

  return {
    totals,
    successCount,
    failedCount,
    pendingCount,
    disputedCount,
    awaitingProofCount,
    successValueAgg,
    failedValueAgg,
    refundedValueAgg,
    byStatus,
    byMethod,
    pendingProofReview,
    awaitingProofNoUpload,
    attention,
    rows,
    walletRows,
    walletCreditAgg,
    walletDebitAgg,
    walletPendingCount,
    partsSalesFromWalletAgg,
    profitPayments,
    partsFinderActivationPayments,
    listMeta,
  };
}

const fetchPaymentIntelligenceAggregateDataCachedInternal = unstable_cache(
  async (params: {
    basePaymentWhere: Prisma.PaymentWhereInput;
    basePaymentWhereSansOrderKind: Prisma.PaymentWhereInput;
    walletWhere: Prisma.WalletTransactionWhereInput;
    paymentsPage?: number;
    walletPage?: number;
    actionPage?: number;
  }) => fetchPaymentIntelligenceAggregateData(params),
  ["ops-payment-intelligence-aggregate:v1"],
  {
    revalidate: 8,
    tags: [OPS_ROUTE_CACHE_TAGS.adminPaymentsIntelligence, OPS_ROUTE_CACHE_TAGS.adminOrders],
  },
);

export async function fetchPaymentIntelligenceAggregateDataCached(params: {
  basePaymentWhere: Prisma.PaymentWhereInput;
  basePaymentWhereSansOrderKind: Prisma.PaymentWhereInput;
  walletWhere: Prisma.WalletTransactionWhereInput;
  paymentsPage?: number;
  walletPage?: number;
  actionPage?: number;
}) {
  return fetchPaymentIntelligenceAggregateDataCachedInternal(params);
}

export type PaymentIntelligenceAggregatePayload = Awaited<ReturnType<typeof fetchPaymentIntelligenceAggregateData>>;
