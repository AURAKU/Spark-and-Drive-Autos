/**
 * Persists vehicle checkout selection in sessionStorage so intent survives refresh
 * or auth redirects when the URL is temporarily missing query params.
 */

const STORAGE_KEY = "sda_checkout_intent";

const VALID_TYPES = new Set(["FULL", "RESERVATION_DEPOSIT"]);

export type CheckoutIntent = {
  carId: string;
  type: "FULL" | "RESERVATION_DEPOSIT";
};

export function persistCheckoutIntent(intent: CheckoutIntent): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readCheckoutIntent(): CheckoutIntent | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return null;
    const carId = (v as { carId?: unknown }).carId;
    const typeRaw = (v as { type?: unknown }).type;
    if (typeof carId !== "string" || !carId.trim()) return null;
    const t = typeof typeRaw === "string" && VALID_TYPES.has(typeRaw) ? typeRaw : "FULL";
    return { carId: carId.trim(), type: t as CheckoutIntent["type"] };
  } catch {
    return null;
  }
}

export function clearCheckoutIntent(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
