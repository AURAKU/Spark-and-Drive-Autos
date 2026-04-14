import type { Prisma } from "@prisma/client";
import { OrderKind, OrderStatus } from "@prisma/client";

/** URL/query values for the admin Cars listing filter (six business states). */
export const CAR_OPS_STATE_VALUES = [
  "SOLD",
  "SHIPPED",
  "IN_TRANSIT",
  "AVAILABLE_GHANA",
  "AVAILABLE_CHINA",
  "RESERVED_DEPOSIT",
] as const;

export type CarOpsStateFilter = (typeof CAR_OPS_STATE_VALUES)[number];

export const CAR_OPS_STATE_LABELS: Record<CarOpsStateFilter, string> = {
  SOLD: "Sold",
  SHIPPED: "Shipped",
  IN_TRANSIT: "In Transit",
  AVAILABLE_GHANA: "Available in Ghana",
  AVAILABLE_CHINA: "Available in China",
  RESERVED_DEPOSIT: "Reserved with Deposit",
};

const SHIPPED_STATUSES: OrderStatus[] = [
  OrderStatus.SHIPPED,
  OrderStatus.AT_PORT,
  OrderStatus.DUTY_PROCESSING,
  OrderStatus.CLEARED,
  OrderStatus.READY_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

export function parseCarOpsStateFilter(raw: string | undefined): CarOpsStateFilter | "" {
  if (!raw) return "";
  return CAR_OPS_STATE_VALUES.includes(raw as CarOpsStateFilter) ? (raw as CarOpsStateFilter) : "";
}

/** Prisma filter for the admin “ops state” dropdown (each option is independent; overlaps are possible). */
export function carWhereForOpsState(state: CarOpsStateFilter): Prisma.CarWhereInput {
  const soldCond: Prisma.CarWhereInput = {
    OR: [{ availabilityStatus: "SOLD" }, { listingState: "SOLD" }],
  };

  switch (state) {
    case "SOLD":
      return soldCond;
    case "RESERVED_DEPOSIT":
      return { availabilityStatus: "RESERVED" };
    case "SHIPPED":
      return {
        orders: {
          some: {
            kind: OrderKind.CAR,
            orderStatus: { in: SHIPPED_STATUSES },
          },
        },
      };
    case "IN_TRANSIT":
      return {
        OR: [{ sourceType: "IN_TRANSIT" }, { availabilityStatus: "IN_TRANSIT_STOCK" }],
      };
    case "AVAILABLE_GHANA":
      return {
        sourceType: "IN_GHANA",
        availabilityStatus: "AVAILABLE",
        listingState: "PUBLISHED",
      };
    case "AVAILABLE_CHINA":
      return {
        sourceType: "IN_CHINA",
        availabilityStatus: "AVAILABLE",
        listingState: "PUBLISHED",
      };
    default:
      return {};
  }
}
