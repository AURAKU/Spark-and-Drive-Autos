import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type RiskSeverity = "low" | "medium" | "high";

export async function logRiskEvent(input: {
  userId: string;
  type: string;
  severity: RiskSeverity;
  meta?: Prisma.InputJsonValue;
}) {
  return prisma.riskEvent.create({
    data: {
      userId: input.userId,
      type: input.type,
      severity: input.severity,
      meta: input.meta,
    },
  });
}
