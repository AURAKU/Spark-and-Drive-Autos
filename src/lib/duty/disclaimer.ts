/** Single source for compliance copy — show wherever duty amounts appear. */

export const DUTY_ESTIMATE_DISCLAIMER_DEFAULT =
  "This calculation is an estimate for planning purposes. Final customs value, duty, taxes, levies, fees and port charges are determined by the Ghana Revenue Authority, Ghana Customs, ICUMS and other relevant authorities at the time of assessment and clearance. Actual amounts may differ because of customs valuation, exchange rates, vehicle classification, effective laws, documentation and administrative assessment.";

export const DUTY_ESTIMATE_DISCLAIMER_SHORT =
  "Spark & Drive Autos estimate — for planning only. Final amounts are determined by Ghana Customs and ICUMS at assessment.";

export const DUTY_ESTIMATE_DISCLAIMER_LONG = [
  DUTY_ESTIMATE_DISCLAIMER_DEFAULT,
  "Spark & Drive Autos calculates import duty estimates using the Duty Intelligence Engine: configurable Ghana tax rules, freight and insurance matrices, live exchange rates, and verified historical imports where available.",
  "Every result is labelled as an estimate unless displaying an imported verified Bill of Entry. Use this figure to plan your budget; your clearing agent will confirm the official assessment at clearance.",
] as const;

/** Admin may customize wording but must retain estimate status. */
export function resolveDutyDisclaimer(adminWording?: string | null): string {
  const custom = adminWording?.trim();
  if (!custom) return DUTY_ESTIMATE_DISCLAIMER_DEFAULT;
  const lower = custom.toLowerCase();
  if (lower.includes("estimate") || lower.includes("planning")) return custom;
  return `${custom} This is an estimate for planning purposes only.`;
}

export const DUTY_INTELLIGENCE_SOURCE_NOTE =
  "Powered by Spark & Drive Duty Intelligence — rates, freight, insurance, and port charges are managed in Admin → Duty Intelligence and applied instantly to every estimate.";
