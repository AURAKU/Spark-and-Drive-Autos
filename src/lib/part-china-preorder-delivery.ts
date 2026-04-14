import { DeliveryMode, PartOrigin, PartStockStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const PREORDER_MODES: DeliveryMode[] = [DeliveryMode.AIR_EXPRESS, DeliveryMode.AIR_STANDARD, DeliveryMode.SEA];

/** Ensure China + pre-order parts have air/sea templates linked from admin-managed records. */
export async function ensureChinaPreOrderDeliveryOptions(partId: string): Promise<void> {
  const part = await prisma.part.findUnique({
    where: { id: partId },
    select: { origin: true, stockStatus: true },
  });
  if (!part || part.origin !== PartOrigin.CHINA || part.stockStatus !== PartStockStatus.ON_REQUEST) {
    return;
  }

  const templates = await prisma.deliveryOptionTemplate.findMany({
    where: { mode: { in: PREORDER_MODES }, active: true },
    orderBy: [{ sortOrder: "asc" }, { mode: "asc" }],
  });

  for (const t of templates) {
    await prisma.partDeliveryOption.upsert({
      where: { partId_templateId: { partId, templateId: t.id } },
      create: { partId, templateId: t.id, enabled: true },
      update: { enabled: true },
    });
  }
}
