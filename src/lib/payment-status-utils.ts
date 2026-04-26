import type { PaymentStatus } from "@prisma/client";

/** Consistent ordering for admin tables and analytics. */
export const PAYMENT_STATUS_ORDER: readonly PaymentStatus[] = [
  "PENDING",
  "AWAITING_PROOF",
  "PROCESSING",
  "UNDER_REVIEW",
  "SUCCESS",
  "FAILED",
  "REFUNDED",
  "DISPUTED",
  "REVERSED",
] as const;

/** Statuses where further customer proof uploads are not allowed (terminal or dispute lock). */
export const PAYMENT_FINAL_STATUSES: PaymentStatus[] = ["SUCCESS", "FAILED", "REFUNDED", "DISPUTED", "REVERSED"];

export function canUploadPaymentProof(status: PaymentStatus): boolean {
  return !PAYMENT_FINAL_STATUSES.includes(status);
}
