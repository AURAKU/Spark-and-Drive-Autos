import type { TxClient } from "@/lib/shipping/parts-china-fees";

/** When a `DUTY` payment succeeds, advance the linked order's duty workflow. */
export async function syncDutyWorkflowAfterDutyPaymentSuccessInTx(tx: TxClient, orderId: string): Promise<void> {
  const duty = await tx.dutyRecord.findFirst({
    where: { orderId },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!duty) return;

  await tx.dutyRecord.update({
    where: { id: duty.id },
    data: {
      workflowStage: "DUTY_PAID",
      status: "DUTY_PAID",
    },
  });
}
