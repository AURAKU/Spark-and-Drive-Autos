export type DutyObservabilityEvent =
  | "calculation_started"
  | "calculation_completed"
  | "calculation_failed"
  | "classification_uncertain"
  | "admin_review_requested"
  | "estimate_saved"
  | "pdf_generated"
  | "sourcing_requested"
  | "support_started"
  | "actual_assessment_linked";

export type DutyEventPayload = {
  event: DutyObservabilityEvent;
  elapsedMs?: number;
  profileId?: string;
  ruleSetVersion?: string;
  confidenceLevel?: string;
  errorCode?: string;
  referenceNumber?: string;
  calculationId?: string;
  userId?: string;
  carId?: string;
  cacheHit?: boolean;
};

/** Structured duty events — no sensitive PII or raw inputs in logs. */
export function emitDutyEvent(payload: DutyEventPayload): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    domain: "duty_intelligence",
    ...payload,
  });
  if (payload.event === "calculation_failed") {
    console.warn("[duty-event]", line);
  } else {
    console.info("[duty-event]", line);
  }
}
