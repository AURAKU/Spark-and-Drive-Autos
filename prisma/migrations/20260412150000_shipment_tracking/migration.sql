-- Shipment tracking (parts Ghana/China, car sea) + optional car sea fee on inventory.
CREATE TYPE "ShipmentKind" AS ENUM ('PARTS_GHANA', 'PARTS_CHINA', 'CAR_SEA');

CREATE TYPE "ShipmentLogisticsStage" AS ENUM (
  'PENDING_SHIPPING_SETUP',
  'PROCESSING',
  'READY_FOR_DISPATCH',
  'IN_TRANSIT',
  'ARRIVED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELAYED',
  'CANCELLED'
);

ALTER TABLE "Car" ADD COLUMN IF NOT EXISTS "seaShippingFeeGhs" DECIMAL(14,2);

CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "ShipmentKind" NOT NULL,
    "deliveryMode" "DeliveryMode",
    "feeAmount" DECIMAL(14,2),
    "feeCurrency" TEXT NOT NULL DEFAULT 'GHS',
    "estimatedDuration" TEXT,
    "trackingNumber" TEXT,
    "carrier" TEXT,
    "currentStage" "ShipmentLogisticsStage" NOT NULL DEFAULT 'PENDING_SHIPPING_SETUP',
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShipmentStatusEvent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "stage" "ShipmentLogisticsStage" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "visibleToCustomer" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShipmentStatusEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Shipment_orderId_idx" ON "Shipment"("orderId");
CREATE INDEX "Shipment_kind_currentStage_idx" ON "Shipment"("kind", "currentStage");
CREATE INDEX "ShipmentStatusEvent_shipmentId_createdAt_idx" ON "ShipmentStatusEvent"("shipmentId", "createdAt");

ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentStatusEvent" ADD CONSTRAINT "ShipmentStatusEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentStatusEvent" ADD CONSTRAINT "ShipmentStatusEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
