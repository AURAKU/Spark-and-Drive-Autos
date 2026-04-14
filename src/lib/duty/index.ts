/** Barrel for duty estimation & operations — import from `@/lib/duty` or subpaths. */
export { computeDutyEstimate, dutyEstimateInputSchema, type DutyEstimateInput, type DutyEstimateLine, type DutyEstimateResult } from "./calculator";
export { DUTY_ESTIMATE_DISCLAIMER_LONG, DUTY_ESTIMATE_DISCLAIMER_SHORT } from "./disclaimer";
export { DUTY_FORMULA_VERSION } from "./formula-version";
export { DUTY_OFFICIAL_LINKS, type DutyOfficialLink } from "./references";
export { DUTY_WORKFLOW_ORDER, dutyWorkflowLabel } from "./workflow";
export type { AdminDutyOrderRow } from "./admin-duty-types";
