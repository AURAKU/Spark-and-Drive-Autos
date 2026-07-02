import { AvailabilityStatus, CarListingState, type Car } from "@prisma/client";

/** Stock state for premium pills on listing cards / hero imagery. */
export type VehicleStockBadgeVariant =
  | "sold"
  | "reserved"
  | "available"
  | "in_transit"
  | "shipping"
  | "processing";

export type VehicleStockBadgeDisplay = {
  label: string;
  variant: VehicleStockBadgeVariant;
};

/**
 * Single source of truth for status pill on imagery (top-right).
 * Sold wins if either `listingState` or `availabilityStatus` is sold (matches checkout + inventory filters).
 */
export function getVehicleStockBadgeForDisplay(
  car: Pick<Car, "listingState" | "availabilityStatus">,
): VehicleStockBadgeDisplay {
  if (car.listingState === CarListingState.SOLD || car.availabilityStatus === AvailabilityStatus.SOLD) {
    return { label: "Sold", variant: "sold" };
  }
  if (car.availabilityStatus === AvailabilityStatus.RESERVED) {
    return { label: "Reserved", variant: "reserved" };
  }
  if (car.availabilityStatus === AvailabilityStatus.AVAILABLE) {
    return { label: "Available", variant: "available" };
  }
  if (car.availabilityStatus === AvailabilityStatus.IN_TRANSIT_STOCK) {
    return { label: "In Transit", variant: "in_transit" };
  }
  if (car.availabilityStatus === AvailabilityStatus.COMING_SOON) {
    return { label: "Shipping", variant: "shipping" };
  }
  if (car.availabilityStatus === AvailabilityStatus.ON_REQUEST) {
    return { label: "Processing", variant: "processing" };
  }
  const raw = car.availabilityStatus;
  return {
    label: (raw != null ? String(raw) : "Unknown").replaceAll("_", " "),
    variant: "processing",
  };
}
