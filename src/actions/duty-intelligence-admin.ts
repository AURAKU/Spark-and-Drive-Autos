"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { dutyCacheInvalidate } from "@/lib/duty-intelligence/cache";
import {
  checkDutyConfigHealth,
  initializeGhanaDutyConfig,
} from "@/lib/duty-intelligence/config-bootstrap";
import { loadCountryConfigSafe } from "@/lib/duty-intelligence/config-loader";
import { getDutyAnalytics } from "@/lib/duty-intelligence/analytics";
import { processDocumentOcr } from "@/lib/duty-intelligence/ocr";
import { isPipelineError, runDutyIntelligencePipeline, saveDutyCalculation } from "@/lib/duty-intelligence/pipeline";
import { recalibrateFromVerifiedImport } from "@/lib/duty-intelligence/self-learning";
import type { DutyIntelligenceResult } from "@/lib/duty-intelligence/types";
import { dutyCalculationInputSchema } from "@/lib/duty-intelligence/types";
import { prisma } from "@/lib/prisma";

export type DutyIntelligenceActionState = { ok?: boolean; error?: string; id?: string; referenceNumber?: string };

const formulaRuleSchema = z.object({
  id: z.string().cuid(),
  rateValue: z.coerce.number(),
  formulaNote: z.string().optional(),
  changeNote: z.string().optional(),
});

const exchangeRateSchema = z.object({
  fromCurrency: z.string().length(3),
  rate: z.coerce.number().positive(),
  source: z.enum(["BANK_OF_GHANA", "CUSTOMS", "MANUAL_OVERRIDE"]),
  isOverride: z.coerce.boolean().optional(),
});

const verifiedImportSchema = z.object({
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().int().optional(),
  vin: z.string().optional(),
  fuelType: z.string().optional(),
  hsCode: z.string().optional(),
  fobAmount: z.coerce.number().optional(),
  fobCurrency: z.string().optional(),
  freightGhs: z.coerce.number().optional(),
  insuranceGhs: z.coerce.number().optional(),
  cifGhs: z.coerce.number().optional(),
  totalDutyGhs: z.coerce.number().optional(),
  totalLandedCostGhs: z.coerce.number().optional(),
  estimatedDutyGhs: z.coerce.number().optional(),
  portChargesGhs: z.coerce.number().optional(),
  shippingLineGhs: z.coerce.number().optional(),
  agentFeesGhs: z.coerce.number().optional(),
  clearanceDays: z.coerce.number().int().optional(),
  shippingLine: z.string().optional(),
  notes: z.string().optional(),
});

export async function calculateDutyIntelligenceAction(
  input: z.infer<typeof dutyCalculationInputSchema>,
): Promise<{ ok: true; result: DutyIntelligenceResult } | { ok: false; error: string }> {
  try {
    const parsed = dutyCalculationInputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid calculation input." };
    const result = await runDutyIntelligencePipeline(parsed.data);
    if (isPipelineError(result)) return { ok: false, error: result.message };
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: "Calculation failed. Please try again." };
  }
}

export async function saveDutyCalculationAction(
  input: z.infer<typeof dutyCalculationInputSchema>,
  result: DutyIntelligenceResult,
): Promise<DutyIntelligenceActionState> {
  const admin = await requireAdmin();
  try {
    const saved = await saveDutyCalculation({
      input,
      result,
      createdById: admin.user.id,
      status: "SAVED",
    });
    revalidatePath("/admin/duty-intelligence");
    return { ok: true, id: saved.id, referenceNumber: saved.referenceNumber };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Save failed." };
  }
}

export async function updateFormulaRuleAction(
  _prev: DutyIntelligenceActionState | null,
  formData: FormData,
): Promise<DutyIntelligenceActionState> {
  const admin = await requireAdmin();
  const parsed = formulaRuleSchema.safeParse({
    id: formData.get("id"),
    rateValue: formData.get("rateValue"),
    formulaNote: formData.get("formulaNote") || undefined,
    changeNote: formData.get("changeNote") || undefined,
  });
  if (!parsed.success) return { error: "Invalid formula update." };

  const existing = await prisma.dutyFormulaRule.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return { error: "Formula rule not found." };

  const newVersion = existing.version + 1;
  await prisma.$transaction(async (tx) => {
    await tx.dutyFormulaRuleHistory.create({
      data: {
        ruleId: existing.id,
        version: existing.version,
        snapshotJson: existing as object,
        changeNote: parsed.data.changeNote,
        actorId: admin.user.id,
      },
    });
    await tx.dutyFormulaRule.update({
      where: { id: existing.id },
      data: { active: false },
    });
    await tx.dutyFormulaRule.create({
      data: {
        countryConfigId: existing.countryConfigId,
        code: existing.code,
        label: existing.label,
        basis: existing.basis,
        rateType: existing.rateType,
        rateValue: parsed.data.rateValue,
        conditionsJson: existing.conditionsJson ?? undefined,
        formulaNote: parsed.data.formulaNote ?? existing.formulaNote,
        version: newVersion,
        sortOrder: existing.sortOrder,
        active: true,
        updatedById: admin.user.id,
      },
    });
    await tx.dutyIntelligenceAuditLog.create({
      data: {
        actorId: admin.user.id,
        action: "FORMULA_UPDATE",
        entityType: "DutyFormulaRule",
        entityId: existing.id,
        beforeJson: { rateValue: existing.rateValue, version: existing.version },
        afterJson: { rateValue: parsed.data.rateValue, version: newVersion },
      },
    });
  });

  await dutyCacheInvalidate("duty:config");
  revalidatePath("/admin/duty-intelligence");
  return { ok: true };
}

export async function addExchangeRateAction(
  _prev: DutyIntelligenceActionState | null,
  formData: FormData,
): Promise<DutyIntelligenceActionState> {
  const admin = await requireAdmin();
  const parsed = exchangeRateSchema.safeParse({
    fromCurrency: formData.get("fromCurrency"),
    rate: formData.get("rate"),
    source: formData.get("source"),
    isOverride: formData.get("isOverride") === "true",
  });
  if (!parsed.success) return { error: "Invalid exchange rate." };

  const config = await loadCountryConfigSafe("GH");
  if (!config) return { error: "Ghana duty configuration not initialized." };
  await prisma.dutyExchangeRate.create({
    data: {
      countryConfigId: config.countryConfigId,
      fromCurrency: parsed.data.fromCurrency.toUpperCase(),
      toCurrency: "GHS",
      rate: parsed.data.rate,
      source: parsed.data.source,
      effectiveDate: new Date(),
      isOverride: parsed.data.isOverride ?? parsed.data.source === "MANUAL_OVERRIDE",
      createdById: admin.user.id,
    },
  });

  await dutyCacheInvalidate("duty:config");
  revalidatePath("/admin/duty-intelligence");
  return { ok: true };
}

export async function createVerifiedImportAction(
  _prev: DutyIntelligenceActionState | null,
  formData: FormData,
): Promise<DutyIntelligenceActionState> {
  const admin = await requireAdmin();
  const parsed = verifiedImportSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Invalid verified import data." };

  const config = await loadCountryConfigSafe("GH");
  if (!config) return { error: "Ghana duty configuration not initialized." };
  const row = await prisma.dutyVerifiedImport.create({
    data: {
      countryConfigId: config.countryConfigId,
      createdById: admin.user.id,
      status: "VERIFIED",
      verifiedAt: new Date(),
      ...parsed.data,
      fuelType: parsed.data.fuelType as never,
    },
  });

  await recalibrateFromVerifiedImport(row.id);
  revalidatePath("/admin/duty-intelligence");
  return { ok: true, id: row.id };
}

export async function verifyImportAction(importId: string): Promise<DutyIntelligenceActionState> {
  await requireAdmin();
  await prisma.dutyVerifiedImport.update({
    where: { id: importId },
    data: { status: "VERIFIED", verifiedAt: new Date() },
  });
  await recalibrateFromVerifiedImport(importId);
  revalidatePath("/admin/duty-intelligence");
  return { ok: true };
}

export async function runOcrOnDocumentAction(
  documentId: string,
  textContent?: string,
): Promise<{ ok: true; extracted: Awaited<ReturnType<typeof processDocumentOcr>> } | { ok: false; error: string }> {
  await requireAdmin();
  const doc = await prisma.dutyVerifiedImportDocument.findUnique({ where: { id: documentId } });
  if (!doc) return { ok: false, error: "Document not found." };

  const extracted = await processDocumentOcr({ documentId, textContent });
  await prisma.dutyVerifiedImportDocument.update({
    where: { id: documentId },
    data: {
      ocrExtractedJson: extracted as object,
      ocrStatus: "COMPLETED",
    },
  });
  return { ok: true, extracted };
}

export async function initializeGhanaDutyConfigAction(): Promise<DutyIntelligenceActionState> {
  await requireAdmin();
  const result = await initializeGhanaDutyConfig();
  if (!result.ok) return { error: result.error };
  await dutyCacheInvalidate("duty:config");
  revalidatePath("/admin/duty-intelligence");
  return { ok: true };
}

const shippingCostSchema = z.object({
  id: z.string().cuid(),
  freightGhs: z.coerce.number().nonnegative(),
  transitDays: z.coerce.number().int().optional(),
});

export async function updateShippingCostAction(
  _prev: DutyIntelligenceActionState | null,
  formData: FormData,
): Promise<DutyIntelligenceActionState> {
  const admin = await requireAdmin();
  const parsed = shippingCostSchema.safeParse({
    id: formData.get("id"),
    freightGhs: formData.get("freightGhs"),
    transitDays: formData.get("transitDays") || undefined,
  });
  if (!parsed.success) return { error: "Invalid shipping cost update." };

  const existing = await prisma.dutyShippingCostMatrix.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return { error: "Shipping cost row not found." };

  await prisma.dutyShippingCostMatrix.update({
    where: { id: parsed.data.id },
    data: {
      freightGhs: parsed.data.freightGhs,
      transitDays: parsed.data.transitDays,
    },
  });
  await prisma.dutyIntelligenceAuditLog.create({
    data: {
      actorId: admin.user.id,
      action: "SHIPPING_COST_UPDATE",
      entityType: "DutyShippingCostMatrix",
      entityId: existing.id,
      beforeJson: { freightGhs: existing.freightGhs, transitDays: existing.transitDays },
      afterJson: { freightGhs: parsed.data.freightGhs, transitDays: parsed.data.transitDays },
    },
  });
  await dutyCacheInvalidate("duty:config");
  revalidatePath("/admin/duty-intelligence");
  return { ok: true };
}

const insuranceRuleSchema = z.object({
  id: z.string().cuid(),
  percentageRate: z.coerce.number().min(0).max(1),
  minimumGhs: z.coerce.number().nonnegative().optional(),
});

export async function updateInsuranceRuleAction(
  _prev: DutyIntelligenceActionState | null,
  formData: FormData,
): Promise<DutyIntelligenceActionState> {
  const admin = await requireAdmin();
  const parsed = insuranceRuleSchema.safeParse({
    id: formData.get("id"),
    percentageRate: formData.get("percentageRate"),
    minimumGhs: formData.get("minimumGhs") || undefined,
  });
  if (!parsed.success) return { error: "Invalid insurance rule update." };

  const existing = await prisma.dutyInsuranceRule.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return { error: "Insurance rule not found." };

  await prisma.dutyInsuranceRule.update({
    where: { id: parsed.data.id },
    data: {
      percentageRate: parsed.data.percentageRate,
      minimumGhs: parsed.data.minimumGhs,
    },
  });
  await prisma.dutyIntelligenceAuditLog.create({
    data: {
      actorId: admin.user.id,
      action: "INSURANCE_RULE_UPDATE",
      entityType: "DutyInsuranceRule",
      entityId: existing.id,
      beforeJson: { percentageRate: existing.percentageRate, minimumGhs: existing.minimumGhs },
      afterJson: { percentageRate: parsed.data.percentageRate, minimumGhs: parsed.data.minimumGhs },
    },
  });
  await dutyCacheInvalidate("duty:config");
  revalidatePath("/admin/duty-intelligence");
  return { ok: true };
}

export async function getDutyIntelligenceDashboardData() {
  await requireAdmin();
  const health = await checkDutyConfigHealth("GH");
  const config = await loadCountryConfigSafe("GH");

  if (!config) {
    return {
      config: null,
      health,
      analytics: {
        totalCalculations: 0,
        totalVerifiedImports: 0,
        avgLandedCostGhs: 0,
        avgPredictionErrorPct: null,
        avgClearanceDays: null,
        monthlyImports: [],
        topVehicles: [],
        topShippingLines: [],
        exchangeRateTrend: [],
      },
      formulaRules: [],
      hsCodes: [],
      exchangeRates: [],
      shippingLines: [],
      shippingCostMatrix: [],
      insuranceRules: [],
      verifiedImports: [],
      calculations: [],
    };
  }

  const [analytics, formulaRules, hsCodes, exchangeRates, shippingLines, shippingCostMatrix, insuranceRules, verifiedImports, calculations] =
    await Promise.all([
      getDutyAnalytics(config.countryConfigId),
      prisma.dutyFormulaRule.findMany({
        where: { countryConfigId: config.countryConfigId, active: true },
        orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      }),
      prisma.dutyHsCode.findMany({
        where: { countryConfigId: config.countryConfigId, active: true },
        orderBy: { hsCode: "asc" },
      }),
      prisma.dutyExchangeRate.findMany({
        where: { countryConfigId: config.countryConfigId },
        orderBy: { effectiveDate: "desc" },
        take: 20,
      }),
      prisma.dutyShippingLine.findMany({
        where: { countryConfigId: config.countryConfigId, active: true },
        include: { chargeTemplates: { where: { active: true } } },
      }),
      prisma.dutyShippingCostMatrix.findMany({
        where: { countryConfigId: config.countryConfigId, active: true },
        orderBy: [{ originCountry: "asc" }, { shippingMethod: "asc" }],
      }),
      prisma.dutyInsuranceRule.findMany({
        where: { countryConfigId: config.countryConfigId, active: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.dutyVerifiedImport.findMany({
        where: { countryConfigId: config.countryConfigId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.dutyCalculation.findMany({
        where: { countryConfigId: config.countryConfigId },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          referenceNumber: true,
          totalLandedCostGhs: true,
          confidenceScore: true,
          confidenceLabel: true,
          createdAt: true,
          hsCode: true,
        },
      }),
    ]);

  return {
    config,
    health,
    analytics,
    formulaRules,
    hsCodes,
    exchangeRates,
    shippingLines,
    shippingCostMatrix,
    insuranceRules,
    verifiedImports,
    calculations,
  };
}
