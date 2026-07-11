import type { RoundingMode } from "../rounding";

export type EngineRuleDefinition = {
  chargeKey: string;
  chargeName: string;
  rateType: "PERCENTAGE" | "FIXED";
  rateValue?: string;
  flatAmount?: string;
  taxableBaseExpression: string;
  roundingMode: RoundingMode;
  decimalPlaces: number;
  dependencyOrder: number;
  sourceReference: string;
  verificationStatus: "VERIFIED" | "UNVERIFIED";
  effectiveFrom: string;
  effectiveTo?: string;
  /** Skip line when computed amount is zero (e.g. Processing Fee 0.00). */
  skipWhenZero?: boolean;
};

export type VersionedRuleSet = {
  id: string;
  version: string;
  profileId: string;
  hsCodes: string[];
  fuelTypes: string[];
  description: string;
  effectiveFrom: string;
  effectiveTo?: string;
  verificationStatus: "VERIFIED" | "UNVERIFIED";
  sourceReference: string;
  rules: EngineRuleDefinition[];
};

function jetourRules(): EngineRuleDefinition[] {
  return [
    { chargeKey: "IMPORT_DUTY", chargeName: "Import Duty", rateType: "PERCENTAGE", rateValue: "0.10", taxableBaseExpression: "CUSTOMS_VALUE_GHS", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 10, sourceReference: "CAL-JETOUR-DASHING-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2024-01-01" },
    { chargeKey: "ECOWAS_LEVY", chargeName: "ECOWAS Levy", rateType: "PERCENTAGE", rateValue: "0.005", taxableBaseExpression: "CIF_GHS", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 20, sourceReference: "CAL-JETOUR-DASHING-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2024-01-01" },
    { chargeKey: "VEHICLE_EXAMINATION_FEE", chargeName: "Vehicle Examination Fee", rateType: "PERCENTAGE", rateValue: "0.01", taxableBaseExpression: "CUSTOMS_VALUE_GHS", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 30, sourceReference: "CAL-JETOUR-DASHING-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2024-01-01" },
    { chargeKey: "NETWORK_CHARGE", chargeName: "Network Charge", rateType: "PERCENTAGE", rateValue: "0.004", taxableBaseExpression: "FOB_GHS", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 40, sourceReference: "CAL-JETOUR-DASHING-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2024-01-01" },
    { chargeKey: "NHIL", chargeName: "Import NHIL", rateType: "PERCENTAGE", rateValue: "0.025", taxableBaseExpression: "CIF_PLUS_IMPORT_DUTY", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 50, sourceReference: "CAL-JETOUR-DASHING-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2024-01-01" },
    { chargeKey: "GETFUND_LEVY", chargeName: "GETFund Levy", rateType: "PERCENTAGE", rateValue: "0.025", taxableBaseExpression: "CIF_PLUS_IMPORT_DUTY", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 51, sourceReference: "CAL-JETOUR-DASHING-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2024-01-01" },
    { chargeKey: "SPECIAL_IMPORT_LEVY", chargeName: "Special Import Levy", rateType: "PERCENTAGE", rateValue: "0.02", taxableBaseExpression: "CIF_GHS", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 52, sourceReference: "CAL-JETOUR-DASHING-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2024-01-01" },
    { chargeKey: "EXIM_LEVY", chargeName: "EXIM Levy", rateType: "PERCENTAGE", rateValue: "0.0075", taxableBaseExpression: "CIF_GHS", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 53, sourceReference: "CAL-JETOUR-DASHING-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2024-01-01" },
    { chargeKey: "AU_LEVY", chargeName: "African Union Import Levy", rateType: "PERCENTAGE", rateValue: "0.002", taxableBaseExpression: "CIF_GHS", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 54, sourceReference: "CAL-JETOUR-DASHING-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2024-01-01" },
    { chargeKey: "NETWORK_CHARGE_VAT", chargeName: "Network Charge VAT", rateType: "PERCENTAGE", rateValue: "0.15", taxableBaseExpression: "SELECTED_LINE:NETWORK_CHARGE", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 60, sourceReference: "CAL-JETOUR-DASHING-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2024-01-01" },
    { chargeKey: "NETWORK_CHARGE_NHIL", chargeName: "Network Charge NHIL", rateType: "PERCENTAGE", rateValue: "0.025", taxableBaseExpression: "SELECTED_LINE:NETWORK_CHARGE", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 61, sourceReference: "CAL-JETOUR-DASHING-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2024-01-01" },
    { chargeKey: "NETWORK_CHARGE_GETFUND", chargeName: "Network Charge GETFund Levy", rateType: "PERCENTAGE", rateValue: "0.025", taxableBaseExpression: "SELECTED_LINE:NETWORK_CHARGE", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 62, sourceReference: "CAL-JETOUR-DASHING-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2024-01-01" },
    { chargeKey: "IMPORT_VAT", chargeName: "Import VAT", rateType: "PERCENTAGE", rateValue: "0.15", taxableBaseExpression: "CIF_PLUS_IMPORT_DUTY", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 70, sourceReference: "CAL-JETOUR-DASHING-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2024-01-01" },
    { chargeKey: "GSA_SNF_FEE", chargeName: "Ghana Shippers Authority SNF Fee", rateType: "FIXED", flatAmount: "12.00", taxableBaseExpression: "FLAT", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 80, sourceReference: "CAL-JETOUR-DASHING-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2024-01-01" },
    { chargeKey: "DISINFECTION_FEE", chargeName: "GHS Disinfection Fee", rateType: "FIXED", flatAmount: "569.76", taxableBaseExpression: "FLAT", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 81, sourceReference: "CAL-JETOUR-DASHING-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2024-01-01" },
    { chargeKey: "MOTI_EIDF_FEE", chargeName: "MoTI e-IDF Fee", rateType: "FIXED", flatAmount: "5.00", taxableBaseExpression: "FLAT", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 82, sourceReference: "CAL-JETOUR-DASHING-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2024-01-01" },
  ];
}

function bydRules(): EngineRuleDefinition[] {
  return [
    { chargeKey: "IMPORT_DUTY", chargeName: "Import Duty", rateType: "PERCENTAGE", rateValue: "0.20", taxableBaseExpression: "CUSTOMS_VALUE_GHS", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 10, sourceReference: "CAL-BYD-SEALION6-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2025-01-01" },
    { chargeKey: "PROCESSING_FEE", chargeName: "Processing Fee", rateType: "FIXED", flatAmount: "0.00", taxableBaseExpression: "FLAT", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 11, sourceReference: "CAL-BYD-SEALION6-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2025-01-01", skipWhenZero: true },
    { chargeKey: "ECOWAS_LEVY", chargeName: "ECOWAS Levy", rateType: "PERCENTAGE", rateValue: "0.005", taxableBaseExpression: "CIF_GHS", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 20, sourceReference: "CAL-BYD-SEALION6-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2025-01-01" },
    { chargeKey: "NETWORK_CHARGE", chargeName: "Network Charge", rateType: "PERCENTAGE", rateValue: "0.004", taxableBaseExpression: "FOB_GHS", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 40, sourceReference: "CAL-BYD-SEALION6-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2025-01-01" },
    { chargeKey: "NHIL", chargeName: "Import NHIL", rateType: "PERCENTAGE", rateValue: "0.025", taxableBaseExpression: "CIF_PLUS_IMPORT_DUTY", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 50, sourceReference: "CAL-BYD-SEALION6-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2025-01-01" },
    { chargeKey: "GETFUND_LEVY", chargeName: "GETFund Levy", rateType: "PERCENTAGE", rateValue: "0.025", taxableBaseExpression: "CIF_PLUS_IMPORT_DUTY", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 51, sourceReference: "CAL-BYD-SEALION6-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2025-01-01" },
    { chargeKey: "SPECIAL_IMPORT_LEVY", chargeName: "Special Import Levy", rateType: "PERCENTAGE", rateValue: "0.02", taxableBaseExpression: "CIF_GHS", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 52, sourceReference: "CAL-BYD-SEALION6-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2025-01-01" },
    { chargeKey: "EXIM_LEVY", chargeName: "EXIM Levy", rateType: "PERCENTAGE", rateValue: "0.0075", taxableBaseExpression: "CIF_GHS", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 53, sourceReference: "CAL-BYD-SEALION6-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2025-01-01" },
    { chargeKey: "AU_LEVY", chargeName: "African Union Import Levy", rateType: "PERCENTAGE", rateValue: "0.002", taxableBaseExpression: "CIF_GHS", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 54, sourceReference: "CAL-BYD-SEALION6-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2025-01-01" },
    { chargeKey: "WITHHOLDING_TAX_IMPORT", chargeName: "1% Withholding Tax on Import", rateType: "PERCENTAGE", rateValue: "0.01", taxableBaseExpression: "CIF_GHS", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 55, sourceReference: "CAL-BYD-SEALION6-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2025-01-01" },
    { chargeKey: "INSPECTION_FEE", chargeName: "Inspection Fee", rateType: "PERCENTAGE", rateValue: "0.01", taxableBaseExpression: "CIF_GHS", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 56, sourceReference: "CAL-BYD-SEALION6-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2025-01-01" },
    { chargeKey: "NETWORK_CHARGE_VAT", chargeName: "Network Charge VAT", rateType: "PERCENTAGE", rateValue: "0.15", taxableBaseExpression: "SELECTED_LINE:NETWORK_CHARGE", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 60, sourceReference: "CAL-BYD-SEALION6-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2025-01-01" },
    { chargeKey: "NETWORK_CHARGE_NHIL", chargeName: "Network Charge NHIL", rateType: "PERCENTAGE", rateValue: "0.025", taxableBaseExpression: "SELECTED_LINE:NETWORK_CHARGE", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 61, sourceReference: "CAL-BYD-SEALION6-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2025-01-01" },
    { chargeKey: "NETWORK_CHARGE_GETFUND", chargeName: "Network Charge GETFund Levy", rateType: "PERCENTAGE", rateValue: "0.025", taxableBaseExpression: "SELECTED_LINE:NETWORK_CHARGE", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 62, sourceReference: "CAL-BYD-SEALION6-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2025-01-01" },
    { chargeKey: "IMPORT_VAT", chargeName: "Import VAT", rateType: "PERCENTAGE", rateValue: "0.15", taxableBaseExpression: "CIF_PLUS_IMPORT_DUTY", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 70, sourceReference: "CAL-BYD-SEALION6-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2025-01-01" },
    { chargeKey: "GSA_SNF_FEE", chargeName: "Ghana Shippers Authority SNF Fee", rateType: "FIXED", flatAmount: "12.00", taxableBaseExpression: "FLAT", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 80, sourceReference: "CAL-BYD-SEALION6-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2025-01-01" },
    { chargeKey: "DISINFECTION_FEE", chargeName: "GHS Disinfection Fee", rateType: "FIXED", flatAmount: "386.94", taxableBaseExpression: "FLAT", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 81, sourceReference: "CAL-BYD-SEALION6-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2025-01-01" },
    { chargeKey: "MOTI_EIDF_FEE", chargeName: "MoTI e-IDF Fee", rateType: "FIXED", flatAmount: "5.00", taxableBaseExpression: "FLAT", roundingMode: "HALF_UP", decimalPlaces: 2, dependencyOrder: 82, sourceReference: "CAL-BYD-SEALION6-BOE", verificationStatus: "VERIFIED", effectiveFrom: "2025-01-01" },
  ];
}

export const VERIFIED_RULE_SETS: VersionedRuleSet[] = [
  {
    id: "ruleset-gh-870323-v1",
    version: "2024.06-jetour-verified-v1",
    profileId: "GH-HS-870323-VERIFIED-V1",
    hsCodes: ["870323", "8703.23"],
    fuelTypes: ["GASOLINE", "GASOLINE_PETROL", "GASOLINE_DIESEL"],
    description: "Verified Jetour Dashing BoE profile — HS 870323 gasoline",
    effectiveFrom: "2024-01-01",
    verificationStatus: "VERIFIED",
    sourceReference: "CAL-JETOUR-DASHING-2022",
    rules: jetourRules(),
  },
  {
    id: "ruleset-gh-870380-v1",
    version: "2025.03-byd-verified-v1",
    profileId: "GH-HS-870380-VERIFIED-V1",
    hsCodes: ["870380", "8703.80"],
    fuelTypes: ["ELECTRIC"],
    description: "Verified BYD Sealion 6 BoE profile — HS 870380 electric",
    effectiveFrom: "2025-01-01",
    verificationStatus: "VERIFIED",
    sourceReference: "CAL-BYD-SEALION6-2025",
    rules: bydRules(),
  },
];

export function getRuleSetByProfileId(profileId: string): VersionedRuleSet | null {
  return VERIFIED_RULE_SETS.find((r) => r.profileId === profileId) ?? null;
}

export function getAllVerifiedRuleSets(): VersionedRuleSet[] {
  return VERIFIED_RULE_SETS;
}
