import { prisma } from "@/lib/prisma";

export type DutyAssessmentAuditAction =
  | "duty.assessment.boe.ingest"
  | "duty.assessment.receipt.attach"
  | "duty.assessment.verify"
  | "duty.assessment.dispute"
  | "duty.assessment.archive"
  | "duty.assessment.document.upload"
  | "duty.assessment.document.archive"
  | "duty.assessment.line.correct"
  | "duty.assessment.prediction.evaluate";

export async function logDutyAssessmentAudit(params: {
  actorId?: string;
  action: DutyAssessmentAuditAction;
  entityType: string;
  entityId?: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  ipAddress?: string;
}): Promise<void> {
  await prisma.dutyIntelligenceAuditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      beforeJson: params.beforeJson as object | undefined,
      afterJson: params.afterJson as object | undefined,
      ipAddress: params.ipAddress,
    },
  });
}
