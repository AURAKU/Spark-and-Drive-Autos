/**
 * Canonical charge keys and alias dictionary for ICUMS / BoE / receipt label reconciliation.
 * Do not merge genuinely different charges (e.g. Network Charge vs Network Charge VAT).
 */

export type ChargeNormalizationEntry = {
  normalizedChargeKey: string;
  displayName: string;
  category: "DUTY" | "LEVY" | "VAT" | "FEE" | "OTHER";
  aliases: string[];
  externalTaxCodes?: string[];
  notes?: string;
};

export const DEFAULT_CHARGE_NORMALIZATION_DICTIONARY: ChargeNormalizationEntry[] = [
  {
    normalizedChargeKey: "IMPORT_DUTY",
    displayName: "Import Duty",
    category: "DUTY",
    aliases: ["Import Duty", "Customs Import Duty", "Duty"],
  },
  {
    normalizedChargeKey: "IMPORT_VAT",
    displayName: "Import VAT",
    category: "VAT",
    aliases: ["Import VAT", "VAT on Import", "VAT", "Value Added Tax on Import"],
  },
  {
    normalizedChargeKey: "ECOWAS_LEVY",
    displayName: "ECOWAS Levy",
    category: "LEVY",
    aliases: ["ECOWAS Levy", "ECOWAS"],
  },
  {
    normalizedChargeKey: "NHIL",
    displayName: "NHIL",
    category: "LEVY",
    aliases: ["Import NHIL", "NHIL", "National Health Insurance Levy"],
  },
  {
    normalizedChargeKey: "GETFUND_LEVY",
    displayName: "GETFund Levy",
    category: "LEVY",
    aliases: [
      "GETFund Levy",
      "GETFund",
      "Ghana Education Trust Fund Levy",
      "GETFUND Levy",
    ],
  },
  {
    normalizedChargeKey: "SPECIAL_IMPORT_LEVY",
    displayName: "Special Import Levy",
    category: "LEVY",
    aliases: ["Special Import Levy", "Special Import Levy (2%)", "SIL"],
  },
  {
    normalizedChargeKey: "EXIM_LEVY",
    displayName: "EXIM Levy",
    category: "LEVY",
    aliases: ["EXIM Levy", "EXIM"],
  },
  {
    normalizedChargeKey: "AU_LEVY",
    displayName: "African Union Import Levy",
    category: "LEVY",
    aliases: ["African Union Import Levy", "AU Levy", "AU Import Levy"],
  },
  {
    normalizedChargeKey: "VEHICLE_EXAMINATION_FEE",
    displayName: "Vehicle Examination Fee",
    category: "FEE",
    aliases: ["Vehicle Examination Fee", "Examination Fee", "Vehicle Exam Fee"],
  },
  {
    normalizedChargeKey: "INSPECTION_FEE",
    displayName: "Inspection Fee",
    category: "FEE",
    aliases: ["Inspection Fee", "Customs Inspection Fee"],
  },
  {
    normalizedChargeKey: "PROCESSING_FEE",
    displayName: "Processing Fee",
    category: "FEE",
    aliases: ["Processing Fee", "Customs Processing Fee"],
  },
  {
    normalizedChargeKey: "NETWORK_CHARGE",
    displayName: "Network Charge",
    category: "FEE",
    aliases: ["Network Charge", "Network Charges", "ICUMS Network Charge"],
  },
  {
    normalizedChargeKey: "NETWORK_CHARGE_VAT",
    displayName: "Network Charge VAT",
    category: "VAT",
    aliases: ["Network Charge VAT", "VAT on Network Charge"],
  },
  {
    normalizedChargeKey: "NETWORK_CHARGE_NHIL",
    displayName: "Network Charge NHIL",
    category: "LEVY",
    aliases: ["Network Charge NHIL", "NHIL on Network Charge"],
  },
  {
    normalizedChargeKey: "NETWORK_CHARGE_GETFUND",
    displayName: "Network Charge GETFund Levy",
    category: "LEVY",
    aliases: [
      "Network Charge GETFund Levy",
      "GETFund Levy on Network Charge",
      "Network Charge GETFund",
    ],
  },
  {
    normalizedChargeKey: "GSA_SNF_FEE",
    displayName: "Ghana Shippers Authority SNF Fee",
    category: "FEE",
    aliases: ["Ghana Shippers Authority SNF Fee", "GSA SNF Fee", "SNF Fee"],
  },
  {
    normalizedChargeKey: "DISINFECTION_FEE",
    displayName: "GHS Disinfection Fee",
    category: "FEE",
    aliases: ["GHS Disinfection Fee", "Disinfection Fee"],
  },
  {
    normalizedChargeKey: "MOTI_EIDF_FEE",
    displayName: "MoTI e-IDF Fee",
    category: "FEE",
    aliases: ["MoTI e-IDF Fee", "e-IDF Fee", "MoTI IDF Fee"],
  },
  {
    normalizedChargeKey: "WITHHOLDING_TAX_IMPORT",
    displayName: "1% Withholding Tax on Import",
    category: "LEVY",
    aliases: ["1% Withholding Tax on Import", "Withholding Tax on Import", "WHT Import"],
  },
];

function normalizeLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s%().-]/g, "");
}

const aliasLookup = new Map<string, string>();

function rebuildAliasLookup(entries: ChargeNormalizationEntry[]): void {
  aliasLookup.clear();
  for (const entry of entries) {
    aliasLookup.set(normalizeLabel(entry.displayName), entry.normalizedChargeKey);
    for (const alias of entry.aliases) {
      aliasLookup.set(normalizeLabel(alias), entry.normalizedChargeKey);
    }
  }
}

rebuildAliasLookup(DEFAULT_CHARGE_NORMALIZATION_DICTIONARY);

export function registerChargeNormalizationEntries(entries: ChargeNormalizationEntry[]): void {
  rebuildAliasLookup([...DEFAULT_CHARGE_NORMALIZATION_DICTIONARY, ...entries]);
}

export function normalizeChargeName(chargeName: string): string {
  const normalized = normalizeLabel(chargeName);
  const key = aliasLookup.get(normalized);
  if (key) return key;

  const slug = chargeName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);

  return slug || "UNKNOWN_CHARGE";
}

export function getChargeDisplayName(normalizedChargeKey: string): string {
  const entry = DEFAULT_CHARGE_NORMALIZATION_DICTIONARY.find((e) => e.normalizedChargeKey === normalizedChargeKey);
  return entry?.displayName ?? normalizedChargeKey.replace(/_/g, " ");
}
