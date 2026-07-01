import type { PrismaClient } from "@prisma/client";

const GHANA_FORMULA_RULES = [
  {
    code: "IMPORT_DUTY",
    label: "Import Duty",
    basis: "CIF" as const,
    rateType: "PERCENTAGE" as const,
    rateValue: 0.32,
    sortOrder: 10,
    conditionsJson: {
      powertrain: "GASOLINE_PETROL",
      ageBands: [
        { maxYears: 5, rate: 0.32 },
        { maxYears: 10, rate: 0.26 },
        { maxYears: 999, rate: 0.18 },
      ],
    },
    formulaNote: "ICE age-based import duty on CIF — configurable per GRA ICUMS bands.",
  },
  {
    code: "IMPORT_DUTY",
    label: "Import Duty (Diesel)",
    basis: "CIF" as const,
    rateType: "PERCENTAGE" as const,
    rateValue: 0.32,
    sortOrder: 11,
    conditionsJson: {
      powertrain: "GASOLINE_DIESEL",
      ageBands: [
        { maxYears: 5, rate: 0.32 },
        { maxYears: 10, rate: 0.26 },
        { maxYears: 999, rate: 0.18 },
      ],
    },
    formulaNote: "Diesel ICE age-based import duty on CIF.",
  },
  {
    code: "IMPORT_DUTY",
    label: "Import Duty (Electric BEV)",
    basis: "CIF" as const,
    rateType: "PERCENTAGE" as const,
    rateValue: 0.2,
    sortOrder: 12,
    conditionsJson: { powertrain: "ELECTRIC", applyEvDutyWaiver: false },
    formulaNote: "ECOWAS CET reference rate for passenger BEV (HS 8703 electric).",
  },
  {
    code: "IMPORT_DUTY",
    label: "Import Duty (EV Waiver Scenario)",
    basis: "CIF" as const,
    rateType: "PERCENTAGE" as const,
    rateValue: 0,
    sortOrder: 13,
    conditionsJson: { powertrain: "ELECTRIC", applyEvDutyWaiver: true },
    formulaNote: "Modeled 0% for qualifying EV relief scenarios — confirm with GRA.",
  },
  {
    code: "IMPORT_DUTY",
    label: "Import Duty (Hybrid)",
    basis: "CIF" as const,
    rateType: "BLENDED" as const,
    rateValue: 0.28,
    sortOrder: 14,
    conditionsJson: {
      powertrain: "HYBRID",
      blend: { iceWeight: 0.72, evRef: 0.2 },
      ageBands: [
        { maxYears: 5, rate: 0.32 },
        { maxYears: 10, rate: 0.26 },
        { maxYears: 999, rate: 0.18 },
      ],
    },
    formulaNote: "Blended hybrid duty rate between ICE age band and BEV reference.",
  },
  {
    code: "IMPORT_DUTY",
    label: "Import Duty (Plug-in Hybrid)",
    basis: "CIF" as const,
    rateType: "BLENDED" as const,
    rateValue: 0.26,
    sortOrder: 15,
    conditionsJson: {
      powertrain: "PLUGIN_HYBRID",
      blend: { iceWeight: 0.48, evRef: 0.2 },
      ageBands: [
        { maxYears: 5, rate: 0.32 },
        { maxYears: 10, rate: 0.26 },
        { maxYears: 999, rate: 0.18 },
      ],
    },
    formulaNote: "Blended PHEV duty rate.",
  },
  { code: "ECOWAS_LEVY", label: "ECOWAS Levy", basis: "CIF" as const, rateType: "PERCENTAGE" as const, rateValue: 0.005, sortOrder: 20, formulaNote: "0.5% ECOWAS levy on CIF." },
  { code: "EDA_LEVY", label: "Export Development Levy", basis: "CIF" as const, rateType: "PERCENTAGE" as const, rateValue: 0.005, sortOrder: 21, formulaNote: "0.5% EDA levy on CIF." },
  { code: "NHIL", label: "NHIL", basis: "CIF" as const, rateType: "PERCENTAGE" as const, rateValue: 0.025, sortOrder: 22, formulaNote: "2.5% National Health Insurance Levy component." },
  { code: "GETFUND", label: "GETFund Levy", basis: "CIF" as const, rateType: "PERCENTAGE" as const, rateValue: 0.025, sortOrder: 23, formulaNote: "2.5% GETFund levy component." },
  { code: "SPECIAL_IMPORT_LEVY", label: "Special Import Levy", basis: "CIF" as const, rateType: "PERCENTAGE" as const, rateValue: 0.01, sortOrder: 24, formulaNote: "1% Special Import Levy." },
  { code: "EXIM_LEVY", label: "EXIM Levy", basis: "CIF" as const, rateType: "PERCENTAGE" as const, rateValue: 0.0075, sortOrder: 25, formulaNote: "0.75% EXIM levy." },
  { code: "AU_LEVY", label: "AU Levy", basis: "CIF" as const, rateType: "PERCENTAGE" as const, rateValue: 0.002, sortOrder: 26, formulaNote: "0.2% African Union levy." },
  { code: "INSPECTION_FEE", label: "Inspection Fee", basis: "FIXED" as const, rateType: "FIXED" as const, rateValue: 350, sortOrder: 30, formulaNote: "Fixed inspection fee (GHS) — update from verified imports." },
  { code: "PROCESSING_FEE", label: "Processing Fee", basis: "FIXED" as const, rateType: "FIXED" as const, rateValue: 280, sortOrder: 31, formulaNote: "ICUMS processing fee estimate." },
  { code: "NETWORK_CHARGES", label: "Network Charges", basis: "FIXED" as const, rateType: "FIXED" as const, rateValue: 120, sortOrder: 32, formulaNote: "Network / system charges." },
  { code: "DISINFECTION_FEE", label: "Disinfection Fee", basis: "FIXED" as const, rateType: "FIXED" as const, rateValue: 85, sortOrder: 33, formulaNote: "Port disinfection charge." },
  { code: "VAT", label: "Import VAT", basis: "VAT_BASE" as const, rateType: "PERCENTAGE" as const, rateValue: 0.15, sortOrder: 40, formulaNote: "15% VAT on (CIF + import duty + levies)." },
];

const GHANA_HS_CODES = [
  { hsCode: "8703.21", description: "Passenger motor cars ≤1000cc", engineCcMin: 0, engineCcMax: 1000 },
  { hsCode: "8703.22", description: "Passenger motor cars 1000–1500cc", engineCcMin: 1001, engineCcMax: 1500 },
  { hsCode: "8703.23", description: "Passenger motor cars 1500–3000cc", engineCcMin: 1501, engineCcMax: 3000 },
  { hsCode: "8703.24", description: "Passenger motor cars >3000cc", engineCcMin: 3001, engineCcMax: 30000 },
  { hsCode: "8703.80", description: "Electric passenger vehicles (BEV)", fuelType: "ELECTRIC" as const, dutyRateHint: 0.2 },
  { hsCode: "8704.21", description: "Commercial diesel trucks ≤5 tonnes", isCommercial: true },
  { hsCode: "8704.31", description: "Commercial gasoline trucks ≤5 tonnes", isCommercial: true },
];

const SHIPPING_LINES = [
  { code: "MSC", name: "MSC Mediterranean Shipping Company" },
  { code: "MAERSK", name: "Maersk Line" },
  { code: "COSCO", name: "COSCO Shipping" },
  { code: "CMA_CGM", name: "CMA CGM" },
  { code: "EVERGREEN", name: "Evergreen Marine" },
  { code: "ONE", name: "Ocean Network Express (ONE)" },
  { code: "OOCL", name: "Orient Overseas Container Line" },
  { code: "PIL", name: "Pacific International Lines" },
  { code: "HAPAG", name: "Hapag-Lloyd" },
];

const PORT_CHARGES = [
  { subcategory: "CONTAINER_HANDLING", label: "Container Handling", amountGhs: 1850 },
  { subcategory: "TERMINAL_HANDLING", label: "Terminal Handling Charge", amountGhs: 1200 },
  { subcategory: "STORAGE", label: "Storage (estimated)", amountGhs: 450 },
  { subcategory: "SCANNING", label: "Container Scanning", amountGhs: 380 },
  { subcategory: "DELIVERY_ORDER", label: "Delivery Order", amountGhs: 220 },
  { subcategory: "SEAL_CHARGES", label: "Seal Charges", amountGhs: 95 },
  { subcategory: "CLEANING", label: "Container Cleaning", amountGhs: 180 },
  { subcategory: "PORT_CHARGES", label: "General Port Charges", amountGhs: 650 },
];

const AGENT_FEES = [
  { subcategory: "AGENT_CHARGES", label: "Clearing Agent Charges", amountGhs: 2800 },
  { subcategory: "GIFF", label: "GIFF Charges", amountGhs: 350 },
  { subcategory: "BROKER_FEES", label: "Customs Broker Fees", amountGhs: 1500 },
  { subcategory: "DOCUMENTATION", label: "Documentation Fees", amountGhs: 420 },
  { subcategory: "INSPECTION_ASSIST", label: "Inspection Assistance", amountGhs: 280 },
  { subcategory: "PORT_FACILITATION", label: "Port Facilitation", amountGhs: 550 },
];

const SHIPPING_LINE_CHARGES = [
  { subcategory: "DOCUMENTATION", label: "Documentation Fees", amountGhs: 380 },
  { subcategory: "CONTAINER", label: "Container Charges", amountGhs: 950 },
  { subcategory: "DELIVERY", label: "Delivery Charges", amountGhs: 620 },
  { subcategory: "RELEASE", label: "Release Fees", amountGhs: 290 },
];

export async function seedDutyIntelligence(prisma: PrismaClient) {
  const country = await prisma.dutyCountryConfig.upsert({
    where: { countryCode: "GH" },
    create: {
      countryCode: "GH",
      name: "Ghana",
      currency: "GHS",
      active: true,
      configJson: { defaultDestinationPort: "Tema", defaultPortOfLoading: "Shanghai" },
    },
    update: { name: "Ghana", active: true },
  });

  for (const rule of GHANA_FORMULA_RULES) {
    const existing = await prisma.dutyFormulaRule.findFirst({
      where: { countryConfigId: country.id, code: rule.code, version: 1 },
    });
    if (!existing) {
      await prisma.dutyFormulaRule.create({
        data: {
          countryConfigId: country.id,
          ...rule,
          conditionsJson: rule.conditionsJson ?? undefined,
          version: 1,
          active: true,
        },
      });
    }
  }

  for (const hs of GHANA_HS_CODES) {
    const existing = await prisma.dutyHsCode.findFirst({
      where: { countryConfigId: country.id, hsCode: hs.hsCode },
    });
    if (!existing) {
      await prisma.dutyHsCode.create({
        data: {
          countryConfigId: country.id,
          hsCode: hs.hsCode,
          description: hs.description,
          engineCcMin: hs.engineCcMin,
          engineCcMax: hs.engineCcMax,
          fuelType: "fuelType" in hs ? hs.fuelType : undefined,
          isCommercial: "isCommercial" in hs ? hs.isCommercial : undefined,
          dutyRateHint: "dutyRateHint" in hs ? hs.dutyRateHint : undefined,
          active: true,
        },
      });
    }
  }

  const globalFx = await prisma.globalCurrencySettings.findUnique({ where: { id: "default" } });
  const usdRate = globalFx ? Number(globalFx.usdToGhs) : 11.65;
  const rmbRate = globalFx ? 1 / Number(globalFx.rmbToGhs) : 1.7;

  const today = new Date();
  for (const [from, rate, source] of [
    ["USD", usdRate, "CUSTOMS" as const],
    ["CNY", rmbRate, "BANK_OF_GHANA" as const],
    ["USD", usdRate, "BANK_OF_GHANA" as const],
  ] as const) {
    const exists = await prisma.dutyExchangeRate.findFirst({
      where: {
        countryConfigId: country.id,
        fromCurrency: from,
        source,
        effectiveDate: { gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()) },
      },
    });
    if (!exists) {
      await prisma.dutyExchangeRate.create({
        data: {
          countryConfigId: country.id,
          fromCurrency: from,
          toCurrency: "GHS",
          rate,
          source,
          effectiveDate: today,
        },
      });
    }
  }

  const lineIds = new Map<string, string>();
  for (const line of SHIPPING_LINES) {
    const row = await prisma.dutyShippingLine.upsert({
      where: { countryConfigId_code: { countryConfigId: country.id, code: line.code } },
      create: { countryConfigId: country.id, ...line, active: true },
      update: { name: line.name, active: true },
    });
    lineIds.set(line.code, row.id);
  }

  for (const charge of PORT_CHARGES) {
    const exists = await prisma.dutyChargeTemplate.findFirst({
      where: { countryConfigId: country.id, category: "PORT", subcategory: charge.subcategory },
    });
    if (!exists) {
      await prisma.dutyChargeTemplate.create({
        data: { countryConfigId: country.id, category: "PORT", ...charge, calculationType: "FIXED", active: true },
      });
    }
  }

  for (const charge of AGENT_FEES) {
    const exists = await prisma.dutyChargeTemplate.findFirst({
      where: { countryConfigId: country.id, category: "AGENT", subcategory: charge.subcategory },
    });
    if (!exists) {
      await prisma.dutyChargeTemplate.create({
        data: { countryConfigId: country.id, category: "AGENT", ...charge, calculationType: "FIXED", active: true },
      });
    }
  }

  for (const [code, lineId] of lineIds) {
    for (const charge of SHIPPING_LINE_CHARGES) {
      const exists = await prisma.dutyChargeTemplate.findFirst({
        where: {
          countryConfigId: country.id,
          category: "SHIPPING_LINE",
          subcategory: charge.subcategory,
          shippingLineId: lineId,
        },
      });
      if (!exists) {
        await prisma.dutyChargeTemplate.create({
          data: {
            countryConfigId: country.id,
            category: "SHIPPING_LINE",
            shippingLineId: lineId,
            ...charge,
            calculationType: "FIXED",
            active: true,
            notes: `Default charges for ${code}`,
          },
        });
      }
    }
  }

  return country;
}
