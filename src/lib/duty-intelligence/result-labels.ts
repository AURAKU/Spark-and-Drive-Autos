import type { DutyConfidenceLevel } from "@/lib/duty-intelligence/types";

/** Customer-safe confidence labels — never imply guaranteed or exact duty. */
export const CUSTOMER_CONFIDENCE_LABELS: Record<DutyConfidenceLevel, string> = {
  VERIFIED_PROFILE_HIGH: "High-confidence estimate",
  STRONG_EVIDENCE: "Standard estimate",
  MODERATE_EVIDENCE: "Standard estimate",
  LIMITED_EVIDENCE: "Limited-data estimate",
  ADMIN_REVIEW_REQUIRED: "Admin review recommended",
};

export function customerConfidenceLabel(level: DutyConfidenceLevel): string {
  return CUSTOMER_CONFIDENCE_LABELS[level] ?? "Limited-data estimate";
}

export const FORBIDDEN_RESULT_PHRASES = [
  "Guaranteed duty",
  "Exact final duty",
  "99.99% accurate",
  "Customs-approved amount",
] as const;
