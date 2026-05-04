import type { Prisma } from "@prisma/client";
import {
  OrderBalanceStatus,
  OrderKind,
  OrderStatus,
  PaymentType,
} from "@prisma/client";

import { addDays, REMINDER_EMAIL_COOLDOWN_DAYS } from "@/lib/deposit-balance-logic";

export type DepositBalanceAdminFilter =
  | "all"
  | "due_soon"
  | "overdue"
  | "paid"
  | "reserved_with_deposit";

/** Admin list filter for vehicle reservation-deposit orders. */
export function buildDepositBalancesWhere(
  f: DepositBalanceAdminFilter,
): Prisma.OrderWhereInput {
  const base: Prisma.OrderWhereInput = {
    kind: OrderKind.CAR,
    paymentType: PaymentType.RESERVATION_DEPOSIT,
  };
  switch (f) {
    case "all":
      return base;
    case "due_soon":
      return { ...base, balanceStatus: OrderBalanceStatus.DUE_SOON };
    case "overdue":
      return {
        ...base,
        OR: [{ balanceStatus: OrderBalanceStatus.OVERDUE }, { followUpRequired: true }],
      };
    case "paid":
      return {
        ...base,
        OR: [{ balanceStatus: OrderBalanceStatus.PAID }, { remainingBalance: { lte: 0 } }],
      };
    case "reserved_with_deposit":
      return {
        ...base,
        orderStatus: OrderStatus.RESERVED_WITH_DEPOSIT,
        remainingBalance: { gt: 0 },
      };
    default:
      return base;
  }
}

/** Orders eligible for next reminder send (cooldown + outstanding). */
export function depositBalanceReminderReadyWhere(now: Date = new Date()): Prisma.OrderWhereInput {
  const cooldownCutoff = addDays(now, -REMINDER_EMAIL_COOLDOWN_DAYS);
  return {
    kind: OrderKind.CAR,
    paymentType: PaymentType.RESERVATION_DEPOSIT,
    orderStatus: { in: [OrderStatus.RESERVED_WITH_DEPOSIT, OrderStatus.AWAITING_BALANCE] },
    remainingBalance: { gt: 0 },
    balanceStatus: { not: OrderBalanceStatus.PAID },
    AND: [
      {
        OR: [{ lastBalanceReminderAt: null }, { lastBalanceReminderAt: { lte: cooldownCutoff } }],
      },
    ],
  };
}
