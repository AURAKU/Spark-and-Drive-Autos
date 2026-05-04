import {
  OrderBalanceStatus,
  OrderKind,
  OrderStatus,
  PaymentStatus,
  PaymentType,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { addDays, BALANCE_DUE_WINDOW_DAYS, deriveBalanceStatus, shouldFlagFollowUpForOverdue } from "@/lib/deposit-balance-logic";

export type RunDepositBalanceStartupResult =
  | { ok: true; backfilledDue: number; backfilledList: number; recomputed: number }
  | { ok: false; reason: string; code?: string };

function describePrismaError(e: unknown): { message: string; code?: string } {
  if (e instanceof Prisma.PrismaClientInitializationError) {
    return { message: e.message, code: "INITIALIZATION" };
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return { message: e.message, code: e.code };
  }
  if (e instanceof Error) {
    return { message: e.message };
  }
  return { message: String(e) };
}

/**
 * Idempotent: backfills missing fields and recomputes `balanceStatus` / `followUpRequired` for vehicle deposit orders.
 * Safe to schedule after process start. Never throws — failures return `{ ok: false }` so instrumentation cannot crash the server.
 */
export async function runDepositBalanceStartupSync(): Promise<RunDepositBalanceStartupResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.warn("[deposit-balance-startup] skipped: DATABASE_URL is not set");
    return { ok: false, reason: "database_url_missing" };
  }

  let backfilledDue = 0;
  let backfilledList = 0;
  let recomputed = 0;

  try {
    const depositOrders = await prisma.order.findMany({
      where: {
        kind: OrderKind.CAR,
        paymentType: PaymentType.RESERVATION_DEPOSIT,
        orderStatus: { in: [OrderStatus.RESERVED_WITH_DEPOSIT, OrderStatus.AWAITING_BALANCE] },
      },
      select: {
        id: true,
        balanceDueAt: true,
        vehicleListPriceGhs: true,
        depositAmount: true,
        remainingBalance: true,
        payments: {
          where: { status: PaymentStatus.SUCCESS, paymentType: PaymentType.RESERVATION_DEPOSIT },
          orderBy: { paidAt: "asc" },
          take: 1,
          select: { paidAt: true },
        },
      },
    });

    for (const o of depositOrders) {
      const paidAt = o.payments[0]?.paidAt;
      if (!o.balanceDueAt && paidAt) {
        await prisma.order.update({
          where: { id: o.id },
          data: { balanceDueAt: addDays(paidAt, BALANCE_DUE_WINDOW_DAYS) },
        });
        backfilledDue += 1;
      }

      if (o.vehicleListPriceGhs == null && o.depositAmount != null && o.remainingBalance != null) {
        const full = Number(o.depositAmount) + Number(o.remainingBalance);
        if (Number.isFinite(full) && full > 0) {
          await prisma.order.update({
            where: { id: o.id },
            data: { vehicleListPriceGhs: Math.round(full * 100) / 100 },
          });
          backfilledList += 1;
        }
      }
    }

    const toRecompute = await prisma.order.findMany({
      where: {
        kind: OrderKind.CAR,
        paymentType: PaymentType.RESERVATION_DEPOSIT,
        orderStatus: { in: [OrderStatus.RESERVED_WITH_DEPOSIT, OrderStatus.AWAITING_BALANCE] },
      },
      select: {
        id: true,
        balanceDueAt: true,
        remainingBalance: true,
      },
    });

    for (const o of toRecompute) {
      const rem = o.remainingBalance != null ? Number(o.remainingBalance) : 0;
      const next = deriveBalanceStatus(rem, o.balanceDueAt ?? null);
      const follow = shouldFlagFollowUpForOverdue(next, rem);
      await prisma.order.update({
        where: { id: o.id },
        data: { balanceStatus: next, followUpRequired: follow },
      });
      recomputed += 1;
    }

    await prisma.order.updateMany({
      where: {
        kind: OrderKind.CAR,
        paymentType: PaymentType.FULL,
        orderStatus: OrderStatus.PAID,
        NOT: { balanceStatus: OrderBalanceStatus.PAID },
      },
      data: {
        balanceStatus: OrderBalanceStatus.PAID,
        remainingBalance: 0,
        followUpRequired: false,
      },
    });

    console.info("[deposit-balance-startup] completed", { backfilledDue, backfilledList, recomputed });
    return { ok: true, backfilledDue, backfilledList, recomputed };
  } catch (e) {
    const { message, code } = describePrismaError(e);
    console.error("[deposit-balance-startup] failed (non-fatal)", { code, message });
    return { ok: false, reason: "sync_failed", code };
  }
}

/**
 * Scheduled deposit-balance maintenance (alias of {@link runDepositBalanceStartupSync}).
 * Idempotent; does not modify fully settled full-pay rows except the explicit PAID balanceStatus patch for CAR+FULL+PAID.
 */
export const runDepositBalanceMaintenance = runDepositBalanceStartupSync;
