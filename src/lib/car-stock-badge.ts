import { AvailabilityStatus, CarListingState, type Car } from "@prisma/client";

/** Stock state for chips on listing cards / hero (next to Ghana stock · China source). */
export type VehicleStockBadgeVariant = "sold" | "reserved" | "available" | "other";

/**
 * Single source of truth for “what to show beside source” on imagery.
 * Sold wins if either `listingState` or `availabilityStatus` is sold (matches checkout + inventory filters).
 */
export function getVehicleStockBadgeForDisplay(
  car: Pick<Car, "listingState" | "availabilityStatus">,
): { label: string; variant: VehicleStockBadgeVariant } {
  if (car.listingState === CarListingState.SOLD || car.availabilityStatus === AvailabilityStatus.SOLD) {
    return { label: "Sold", variant: "sold" };
  }
  if (car.availabilityStatus === AvailabilityStatus.RESERVED) {
    return { label: "Reserved", variant: "reserved" };
  }
  if (car.availabilityStatus === AvailabilityStatus.AVAILABLE) {
    return { label: "Available", variant: "available" };
  }
  const raw = car.availabilityStatus;
  return {
    label: (raw != null ? String(raw) : "Unknown").replaceAll("_", " "),
    variant: "other",
  };
}
