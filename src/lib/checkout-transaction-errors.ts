import type { CheckoutIneligibleReason } from "@/lib/checkout-eligibility";

export type CheckoutConflictCode = "INELIGIBLE" | "ALREADY_PURCHASED" | "CAR_NOT_FOUND";

export function throwCheckoutConflict(code: CheckoutConflictCode, reason?: CheckoutIneligibleReason): never {
  const e = new Error(`checkout:${code}`);
  (e as Error & { checkoutCode: CheckoutConflictCode; checkoutReason?: CheckoutIneligibleReason }).checkoutCode = code;
  if (reason !== undefined) {
    (e as Error & { checkoutReason?: CheckoutIneligibleReason }).checkoutReason = reason;
  }
  throw e;
}

export function isCheckoutConflictError(
  e: unknown,
): e is Error & { checkoutCode: CheckoutConflictCode; checkoutReason?: CheckoutIneligibleReason } {
  return (
    e instanceof Error &&
    "checkoutCode" in e &&
    typeof (e as { checkoutCode: string }).checkoutCode === "string"
  );
}
