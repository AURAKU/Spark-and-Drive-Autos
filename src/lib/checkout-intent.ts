/**
 * Persists vehicle checkout selection in sessionStorage so intent survives refresh
 * or auth redirects when the URL is temporarily missing query params.
 */

const STORAGE_KEY = "sda_checkout_intent";

const VALID_TYPES = new Set(["FULL", "RESERVATION_DEPOSIT"]);

export type CheckoutIntent = {
  vehicleKind: "car" | "motorcycle";
  vehicleId: string;
  type: "FULL" | "RESERVATION_DEPOSIT";
};

/** @deprecated Use vehicleId — kept for reads of legacy stored intents. */
export type LegacyCheckoutIntent = {
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
    const typeRaw = (v as { type?: unknown }).type;
    const t = typeof typeRaw === "string" && VALID_TYPES.has(typeRaw) ? typeRaw : "FULL";

    const vehicleKindRaw = (v as { vehicleKind?: unknown }).vehicleKind;
    const vehicleIdRaw = (v as { vehicleId?: unknown }).vehicleId;
    if (
      (vehicleKindRaw === "car" || vehicleKindRaw === "motorcycle") &&
      typeof vehicleIdRaw === "string" &&
      vehicleIdRaw.trim()
    ) {
      return {
        vehicleKind: vehicleKindRaw,
        vehicleId: vehicleIdRaw.trim(),
        type: t as CheckoutIntent["type"],
      };
    }

    const carId = (v as LegacyCheckoutIntent).carId;
    if (typeof carId === "string" && carId.trim()) {
      return { vehicleKind: "car", vehicleId: carId.trim(), type: t as CheckoutIntent["type"] };
    }
    return null;
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

/** Build checkout URL from intent fields. */
export function checkoutUrlForVehicle(params: {
  vehicleKind: "car" | "motorcycle";
  vehicleId: string;
  type: CheckoutIntent["type"];
}): string {
  const q = new URLSearchParams();
  if (params.vehicleKind === "motorcycle") {
    q.set("motorcycleId", params.vehicleId);
  } else {
    q.set("carId", params.vehicleId);
  }
  q.set("type", params.type);
  return `/checkout?${q.toString()}`;
}
