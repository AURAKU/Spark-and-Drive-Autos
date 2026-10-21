/** Single source for compliance copy — show wherever duty amounts appear. */

export const DUTY_ESTIMATE_DISCLAIMER_SHORT =
  "This is an automatically provided duty-payable estimate by Spark & Drive Autos, accurate to the best of our knowledge based on current Ghana computational formulae. Ghana Customs reserves the right to present any duty payable based on government policy or officer discretion. This estimate is for planning only and is not a Customs assessment.";

export const DUTY_ESTIMATE_DISCLAIMER_LONG = [
  "Spark & Drive Autos calculates import duty estimates using Spark & Drive Duty Intelligence: configurable Ghana tax rules, freight and insurance matrices, port and clearing charges, live exchange rates, and verified historical imports.",
  "Estimates update when our rules, freight, insurance, or exchange rates change. No third-party calculator is required to use this tool.",
  "Final duty, levies, and fees are determined by Ghana Customs when your vehicle is declared and cleared. You may use this report to plan your budget. It cannot be used to contest a Customs assessment.",
] as const;

export const DUTY_INTELLIGENCE_SOURCE_NOTE =
  "Powered by Spark & Drive Duty Intelligence. Rates, freight, insurance, and port charges are applied instantly to every estimate.";
