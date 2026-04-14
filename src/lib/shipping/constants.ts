import type { ShipmentLogisticsStage } from "@prisma/client";

/** Primary happy-path flow (delayed/cancelled branch from any step). */
export const SHIPMENT_STAGE_FLOW: ShipmentLogisticsStage[] = [
  "PENDING_SHIPPING_SETUP",
  "PROCESSING",
  "READY_FOR_DISPATCH",
  "IN_TRANSIT",
  "ARRIVED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export const SHIPMENT_STAGE_LABEL: Record<ShipmentLogisticsStage, string> = {
  PENDING_SHIPPING_SETUP: "Pending setup",
  PROCESSING: "Processing",
  READY_FOR_DISPATCH: "Ready for dispatch",
  IN_TRANSIT: "In transit",
  ARRIVED: "Arrived",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  DELAYED: "Delayed",
  CANCELLED: "Cancelled",
};

export const SHIPMENT_KIND_LABEL: Record<string, string> = {
  PARTS_GHANA: "Parts · Ghana",
  PARTS_CHINA: "Parts · China",
  CAR_SEA: "Vehicle · Sea freight",
};
