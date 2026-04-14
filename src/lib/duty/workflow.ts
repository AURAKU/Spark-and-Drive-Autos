import type { DutyWorkflowStage } from "@prisma/client";

export const DUTY_WORKFLOW_ORDER: DutyWorkflowStage[] = [
  "NOT_STARTED",
  "DUTY_ESTIMATE_GENERATED",
  "AWAITING_ARRIVAL",
  "ARRIVED_AT_PORT",
  "AWAITING_OFFICIAL_ASSESSMENT",
  "DUTY_CONFIRMED",
  "AWAITING_DUTY_PAYMENT",
  "DUTY_PAYMENT_IN_PROGRESS",
  "DUTY_PAID",
  "CLEARANCE_IN_PROGRESS",
  "CLEARED",
  "DELIVERED_READY_FOR_PICKUP",
];

const LABELS: Record<DutyWorkflowStage, string> = {
  NOT_STARTED: "Not started",
  DUTY_ESTIMATE_GENERATED: "Duty estimate generated",
  AWAITING_ARRIVAL: "Awaiting arrival (sea)",
  ARRIVED_AT_PORT: "Arrived at port",
  AWAITING_OFFICIAL_ASSESSMENT: "Awaiting official assessment",
  DUTY_CONFIRMED: "Duty confirmed (official figure)",
  AWAITING_DUTY_PAYMENT: "Awaiting duty payment",
  DUTY_PAYMENT_IN_PROGRESS: "Duty payment in progress",
  DUTY_PAID: "Duty paid",
  CLEARANCE_IN_PROGRESS: "Clearance in progress",
  CLEARED: "Cleared",
  DELIVERED_READY_FOR_PICKUP: "Delivered / ready for pickup",
};

export function dutyWorkflowLabel(stage: DutyWorkflowStage): string {
  return LABELS[stage] ?? stage;
}
