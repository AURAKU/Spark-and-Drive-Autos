import type { TxClient } from "@/lib/shipping/parts-china-fees";

/**
 * Ensures a duty row exists for a paid vehicle order and links the sea shipment when created.
 * Idempotent: updates `shipmentId` on the latest row if missing.
 */
export async function ensureDutyRecordForCarSeaInTx(
  tx: TxClient,
  params: { orderId: string; shipmentId: string },
): Promise<void> {
  const latest = await tx.dutyRecord.findFirst({
    where: { orderId: params.orderId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, shipmentId: true },
  });

  if (latest) {
    if (!latest.shipmentId) {
      await tx.dutyRecord.update({
        where: { id: latest.id },
        data: { shipmentId: params.shipmentId },
      });
    }
    return;
  }

  await tx.dutyRecord.create({
    data: {
      orderId: params.orderId,
      shipmentId: params.shipmentId,
      currency: "GHS",
      workflowStage: "NOT_STARTED",
    },
  });
}
