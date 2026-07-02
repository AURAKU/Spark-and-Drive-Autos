import type { AvailabilityStatus, CarListingState, SourceType } from "@prisma/client";

import { getVehicleStockBadgeForDisplay } from "@/lib/car-stock-badge";

type MotorcycleBadgeInput = {
  sourceType: SourceType;
  availabilityStatus: AvailabilityStatus;
  listingState: CarListingState;
};

/** Reuses car stock badge logic — motorcycles share the same availability model. */
export function getMotorcycleStockBadgeForDisplay(m: MotorcycleBadgeInput) {
  return getVehicleStockBadgeForDisplay(m);
}
