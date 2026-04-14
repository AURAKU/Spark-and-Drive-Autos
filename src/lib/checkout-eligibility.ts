import { AvailabilityStatus, CarListingState, SourceType, type Car } from "@prisma/client";

export type CheckoutIneligibleReason =
  | "NOT_PUBLISHED"
  | "VEHICLE_SOLD"
  | "VEHICLE_RESERVED"
  | "IN_TRANSIT_NOT_FOR_CHECKOUT";

/**
 * Server-side guard: published China/Ghana stock can checkout when available.
 * Sold listings, reserved stock, and in-transit pipeline listings cannot be paid online.
 */
export function getCarCheckoutIneligibleReason(
  car: Pick<Car, "listingState" | "availabilityStatus" | "sourceType"> | null,
): CheckoutIneligibleReason | null {
  if (!car) return "NOT_PUBLISHED";
  if (car.listingState === CarListingState.SOLD || car.availabilityStatus === AvailabilityStatus.SOLD) {
    return "VEHICLE_SOLD";
  }
  if (car.listingState !== CarListingState.PUBLISHED) {
    return "NOT_PUBLISHED";
  }
  if (car.sourceType === SourceType.IN_TRANSIT) {
    return "IN_TRANSIT_NOT_FOR_CHECKOUT";
  }
  if (car.availabilityStatus === AvailabilityStatus.RESERVED) {
    return "VEHICLE_RESERVED";
  }
  return null;
}

/** Short, customer-facing copy when checkout / Paystack / manual intent must be refused. */
export function customerCheckoutBlockedMessage(reason: CheckoutIneligibleReason): string {
  const line =
    "Please contact customer support to request the same model, a similar vehicle, or help with your order.";
  switch (reason) {
    case "VEHICLE_SOLD":
      return `Dear customer, this car has already been purchased. ${line}`;
    case "VEHICLE_RESERVED":
      return `Dear customer, this vehicle is currently reserved by another buyer. ${line}`;
    case "IN_TRANSIT_NOT_FOR_CHECKOUT":
      return `Dear customer, this vehicle is in transit and cannot be paid for on this listing yet. ${line}`;
    case "NOT_PUBLISHED":
    default:
      return `This listing is not available for online checkout. ${line}`;
  }
}
