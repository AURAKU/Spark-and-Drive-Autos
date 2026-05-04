import { OrderBalanceStatus } from "@prisma/client";

/** Days from successful deposit payment to balance due date. */
export const BALANCE_DUE_WINDOW_DAYS = 21;

/** Within this many days of `balanceDueAt`, status becomes DUE_SOON (if still outstanding). */
export const DUE_SOON_LEAD_DAYS = 7;

/** Minimum days between automated/admin reminder sends (when email is used). */
export const REMINDER_EMAIL_COOLDOWN_DAYS = 7;

export function addDays(d: Date, days: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

/**
 * Derive balance lifecycle status from outstanding amount and due date.
 * Returns PAID when nothing is owed regardless of dates.
 */
export function deriveBalanceStatus(
  remainingGhs: number,
  balanceDueAt: Date | null | undefined,
  now: Date = new Date(),
): OrderBalanceStatus {
  const rem = Number.isFinite(remainingGhs) ? remainingGhs : 0;
  if (rem <= 0) return OrderBalanceStatus.PAID;
  if (!balanceDueAt) return OrderBalanceStatus.CURRENT;
  const dueMs = balanceDueAt.getTime();
  const nowMs = now.getTime();
  if (nowMs > dueMs) return OrderBalanceStatus.OVERDUE;
  if (dueMs - nowMs <= DUE_SOON_LEAD_DAYS * 86_400_000) return OrderBalanceStatus.DUE_SOON;
  return OrderBalanceStatus.CURRENT;
}

export function shouldFlagFollowUpForOverdue(
  status: OrderBalanceStatus,
  remainingGhs: number,
): boolean {
  const rem = Number.isFinite(remainingGhs) ? remainingGhs : 0;
  return status === OrderBalanceStatus.OVERDUE && rem > 0;
}
