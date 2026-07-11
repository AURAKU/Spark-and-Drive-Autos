import { prisma } from "@/lib/prisma";

export type DutyAdminAuditAction =
  | "duty.rule.create"
  | "duty.rule.update"
  | "duty.rule.publish"
  | "duty.rule.retire"
  | "duty.rule.clone"
  | "duty.profile.update"
  | "duty.fx.create"
  | "duty.fx.override"
  | "duty.settings.update"
  | "duty.assessment.verify"
  | "duty.assessment.reject"
  | "duty.assessment.calibration.toggle"
  | "duty.charge_mapping.correct";

export async function logDutyAdminAudit(params: {
  actorId: string;
  action: DutyAdminAuditAction;
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
