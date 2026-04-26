import type { ShipmentKind, ShipmentLogisticsStage } from "@prisma/client";

import { GhanaPartsShipmentFlowVisual } from "@/components/shipping/ghana-parts-shipment-flow-visual";
import { ShipmentFlowVisual } from "@/components/shipping/shipment-flow-visual";

/**
 * Renders the standard 7-node logistics rail, or the 6-node Ghana parts & accessories (local stock) flow.
 */
export function ShipmentFlowByKind({
  kind,
  currentStage,
  compact = false,
}: {
  kind: ShipmentKind;
  currentStage: ShipmentLogisticsStage;
  compact?: boolean;
}) {
  if (kind === "PARTS_GHANA") {
    return <GhanaPartsShipmentFlowVisual currentStage={currentStage} compact={compact} />;
  }
  return <ShipmentFlowVisual currentStage={currentStage} compact={compact} />;
}
