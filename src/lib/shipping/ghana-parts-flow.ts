import type { ShipmentLogisticsStage } from "@prisma/client";

/**
 * Customer-facing milestone copy for parts & accessories fulfilled from Ghana stock.
 * Maps 1:1 to `ShipmentLogisticsStage` (except OUT_FOR_DELIVERY shares the final column with DELIVERED).
 */
export const GHANA_PARTS_FLOW_LABELS = [
  "Order Pending",
  "Order Processing",
  "Ready for dispatch",
  "In transit",
  "Arrived",
  "Delivered",
] as const;

export type GhanaPartsFlowState = {
  activeIndex: number;
  allComplete: boolean;
  isException: boolean;
  /** Final-mile handoff (enum has no extra step in the 6-lane UI). */
  lastStepSubLabel?: string;
};

const EARLY: ShipmentLogisticsStage[] = [
  "PENDING_SHIPPING_SETUP",
  "PROCESSING",
  "READY_FOR_DISPATCH",
  "IN_TRANSIT",
  "ARRIVED",
];

/**
 * Resolves which of the 6 columns is active and whether the journey is complete.
 */
export function getGhanaPartsFlowState(currentStage: ShipmentLogisticsStage): GhanaPartsFlowState {
  if (currentStage === "DELAYED" || currentStage === "CANCELLED") {
    return { activeIndex: -1, allComplete: false, isException: true };
  }
  if (currentStage === "DELIVERED") {
    return { activeIndex: 5, allComplete: true, isException: false };
  }
  if (currentStage === "OUT_FOR_DELIVERY") {
    return { activeIndex: 5, allComplete: false, isException: false, lastStepSubLabel: "Out for delivery" };
  }
  const i = EARLY.indexOf(currentStage);
  if (i >= 0) return { activeIndex: i, allComplete: false, isException: false };
  return { activeIndex: 0, allComplete: false, isException: false };
}

/** Badge / summary line for PARTS_GHANA shipments. */
export function ghanaPartsCustomerStageLabel(currentStage: ShipmentLogisticsStage): string {
  if (currentStage === "PENDING_SHIPPING_SETUP") return "Order Pending";
  if (currentStage === "PROCESSING") return "Order Processing";
  if (currentStage === "READY_FOR_DISPATCH") return "Ready for dispatch";
  if (currentStage === "IN_TRANSIT") return "In transit";
  if (currentStage === "ARRIVED") return "Arrived";
  if (currentStage === "OUT_FOR_DELIVERY") return "Out for delivery";
  if (currentStage === "DELIVERED") return "Delivered";
  if (currentStage === "DELAYED") return "Delayed";
  if (currentStage === "CANCELLED") return "Cancelled";
  return currentStage;
}
