export type DutyEngineErrorCode =
  | "MISSING_CLASSIFICATION"
  | "NEEDS_CLASSIFICATION"
  | "MISSING_RULE_SET"
  | "MISSING_FX_RATE"
  | "MISSING_CUSTOMS_VALUE"
  | "RULE_DEPENDENCY_ERROR"
  | "UNVERIFIED_RULE"
  | "ADMIN_REVIEW_REQUIRED"
  | "CONFIG_UNAVAILABLE"
  | "VALIDATION_ERROR";

export type DutyEngineError = {
  code: DutyEngineErrorCode;
  message: string;
  details?: Record<string, unknown>;
  missingFields?: string[];
};

export function engineError(
  code: DutyEngineErrorCode,
  message: string,
  extras?: Partial<Omit<DutyEngineError, "code" | "message">>,
): DutyEngineError {
  return { code, message, ...extras };
}

export function isEngineError(value: unknown): value is DutyEngineError {
  return (
    typeof value === "object" &&
    value != null &&
    "code" in value &&
    typeof (value as DutyEngineError).code === "string" &&
    "message" in value
  );
}
