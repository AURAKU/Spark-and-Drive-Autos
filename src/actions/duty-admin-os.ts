"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { logDutyAdminAudit } from "@/lib/duty-admin/audit";
import {
  compareAssessmentToCalculation,
  getAssessmentDetail,
  getCalculationDetail,
  listAssessments,
  listCalculations,
  rejectAssessment,
  requestAssessmentCorrection,
  setCalibrationEligibility,
  verifyAssessment,
} from "@/lib/duty-admin/assessments";
import { getCalibrationAnalytics } from "@/lib/duty-admin/calibration";
import { getDutyAdminDashboard } from "@/lib/duty-admin/dashboard";
import { validateFxRateInput } from "@/lib/duty-admin/fx-rates";
import { parsePagination } from "@/lib/duty-admin/pagination";
import { detectProfileConflicts } from "@/lib/duty-admin/profiles";
import {
  cloneRuleSet,
  listCalculationRules,
  publishDraftRules,
  retireRule,
  runVerifiedFixtureRegression,
  updateDraftRule,
} from "@/lib/duty-admin/rules";
import { mergeDutyAdminSettings, parseDutyAdminSettings } from "@/lib/duty-admin/settings";
import { dutyCacheInvalidate } from "@/lib/duty-intelligence/cache";
import { ensureCountryConfig } from "@/lib/duty-intelligence/config-loader";
import { prisma } from "@/lib/prisma";

export type DutyAdminOsState = { ok?: boolean; error?: string; id?: string };

const ruleDraftSchema = z.object({
  countryConfigId: z.string().cuid(),
  profileId: z.string().cuid().optional(),
  chargeKey: z.string().trim().min(1).max(64),
  chargeName: z.string().trim().min(1),
  rateType: z.enum(["PERCENTAGE", "FIXED"]),
  rateValue: z.coerce.number().optional(),
  flatAmount: z.coerce.number().optional(),
  taxableBaseExpression: z.string().trim().min(1).max(256),
  dependencyOrder: z.coerce.number().int().default(0),
  decimalPlaces: z.coerce.number().int().min(0).max(6).default(2),
  sourceId: z.string().cuid(),
  effectiveFrom: z.coerce.date().optional(),
});

const ruleSourceSchema = z.object({
  sourceType: z.enum(["GRA_PUBLICATION", "ICUMS_EXPORT", "BILL_OF_ENTRY", "PAYMENT_RECEIPT", "TARIFF_SCHEDULE", "ADMIN_VERIFIED", "UNKNOWN"]),
  title: z.string().trim().min(1),
  reference: z.string().trim().min(1),
  officialUrl: z.string().url().optional().or(z.literal("")),
  effectiveFrom: z.coerce.date(),
  notes: z.string().optional(),
});

const settingsPatchSchema = z.object({
  publicCalculatorEnabled: z.coerce.boolean().optional(),
  defaultEstimateBandPct: z.coerce.number().optional(),
  staleFxThresholdDays: z.coerce.number().int().optional(),
  minimumCalibrationSampleSize: z.coerce.number().int().optional(),
  highValueThresholdGhs: z.coerce.number().optional(),
  disclaimer: z.string().optional(),
});

async function ghanaConfig() {
  const config = await ensureCountryConfig("GH");
  if (!config) throw new Error("Ghana duty configuration not initialized.");
  return config;
}

export async function getDutyAdminDashboardData() {
  await requireAdmin();
  const config = await ghanaConfig();
  const [dashboard, settings] = await Promise.all([
    getDutyAdminDashboard(config.countryConfigId),
    prisma.dutyCountryConfig.findUnique({
      where: { id: config.countryConfigId },
      select: { configJson: true },
    }),
  ]);
  return {
    countryConfigId: config.countryConfigId,
    dashboard,
    settings: parseDutyAdminSettings(settings?.configJson),
  };
}

export async function getDutyAdminRulesData(searchParams: Record<string, string | string[] | undefined>) {
  await requireAdmin();
  const config = await ghanaConfig();
  const { page, pageSize } = parsePagination(searchParams, 20);
  const status = typeof searchParams.status === "string" ? searchParams.status : undefined;
  const rules = await listCalculationRules({
    countryConfigId: config.countryConfigId,
    status,
    page,
    pageSize,
  });
  const sources = await prisma.dutyRuleSource.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  const regression = runVerifiedFixtureRegression();
  return { ...rules, page, pageSize, sources, regression, countryConfigId: config.countryConfigId };
}

export async function getDutyAdminAssessmentsData(searchParams: Record<string, string | string[] | undefined>) {
  await requireAdmin();
  const config = await ghanaConfig();
  const { page, pageSize } = parsePagination(searchParams, 20);
  const status = typeof searchParams.status === "string" ? searchParams.status : undefined;
  return listAssessments({
    countryConfigId: config.countryConfigId,
    verificationStatus: status,
    page,
    pageSize,
  });
}

export async function getDutyAdminAssessmentDetailData(assessmentId: string) {
  await requireAdmin();
  return getAssessmentDetail(assessmentId);
}

export async function getDutyAdminCalculationsData(searchParams: Record<string, string | string[] | undefined>) {
  await requireAdmin();
  const config = await ghanaConfig();
  const { page, pageSize } = parsePagination(searchParams, 20);
  const result = await listCalculations({ countryConfigId: config.countryConfigId, page, pageSize });
  return { ...result, page, pageSize };
}

export async function getDutyAdminCalculationDetailData(calculationId: string) {
  await requireAdmin();
  return getCalculationDetail(calculationId);
}

export async function getDutyAdminCalibrationData() {
  await requireAdmin();
  const config = await ghanaConfig();
  return getCalibrationAnalytics(config.countryConfigId);
}

export async function getDutyAdminSettingsData() {
  await requireAdmin();
  const config = await ghanaConfig();
  const row = await prisma.dutyCountryConfig.findUniqueOrThrow({
    where: { id: config.countryConfigId },
    select: { configJson: true },
  });
  return parseDutyAdminSettings(row.configJson);
}

export async function getDutyAdminAuditData(searchParams: Record<string, string | string[] | undefined>) {
  await requireAdmin();
  const { page, pageSize } = parsePagination(searchParams, 25);
  const where = {
    OR: [
      { entityType: { contains: "Duty" } },
      { action: { startsWith: "duty." } },
    ],
  };
  const [items, totalItems] = await Promise.all([
    prisma.dutyIntelligenceAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { email: true, name: true } } },
    }),
    prisma.dutyIntelligenceAuditLog.count({ where }),
  ]);
  return { items, page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) };
}

export async function createRuleSourceAction(input: z.infer<typeof ruleSourceSchema>): Promise<DutyAdminOsState> {
  const admin = await requireAdmin();
  const parsed = ruleSourceSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid rule source." };

  const row = await prisma.dutyRuleSource.create({
    data: {
      sourceType: parsed.data.sourceType,
      title: parsed.data.title,
      reference: parsed.data.reference,
      officialUrl: parsed.data.officialUrl || null,
      effectiveFrom: parsed.data.effectiveFrom,
      notes: parsed.data.notes,
      verificationStatus: "VERIFIED",
      reviewedById: admin.user.id,
      reviewedAt: new Date(),
    },
  });

  await logDutyAdminAudit({
    actorId: admin.user.id,
    action: "duty.rule.create",
    entityType: "DutyRuleSource",
    entityId: row.id,
    afterJson: row,
  });

  revalidatePath("/admin/duty/rules");
  return { ok: true, id: row.id };
}

export async function createDraftRuleAction(input: z.infer<typeof ruleDraftSchema>): Promise<DutyAdminOsState> {
  const admin = await requireAdmin();
  const parsed = ruleDraftSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid rule draft." };

  const row = await prisma.dutyCalculationRule.create({
    data: {
      countryConfigId: parsed.data.countryConfigId,
      profileId: parsed.data.profileId,
      chargeKey: parsed.data.chargeKey,
      chargeName: parsed.data.chargeName,
      rateType: parsed.data.rateType,
      rateValue: parsed.data.rateValue,
      flatAmount: parsed.data.flatAmount,
      taxableBaseExpression: parsed.data.taxableBaseExpression,
      dependencyOrder: parsed.data.dependencyOrder,
      decimalPlaces: parsed.data.decimalPlaces,
      effectiveFrom: parsed.data.effectiveFrom ?? new Date(),
      sourceId: parsed.data.sourceId,
      status: "DRAFT",
      createdById: admin.user.id,
    },
  });

  await logDutyAdminAudit({
    actorId: admin.user.id,
    action: "duty.rule.create",
    entityType: "DutyCalculationRule",
    entityId: row.id,
    afterJson: row,
  });

  revalidatePath("/admin/duty/rules");
  return { ok: true, id: row.id };
}

export async function updateDraftRuleAction(params: {
  ruleId: string;
  chargeName?: string;
  rateType?: "PERCENTAGE" | "FIXED";
  rateValue?: number;
  flatAmount?: number;
  taxableBaseExpression?: string;
  dependencyOrder?: number;
  sourceId?: string;
}): Promise<DutyAdminOsState> {
  const admin = await requireAdmin();
  const result = await updateDraftRule({ ruleId: params.ruleId, patch: params });
  if (!result.ok) return { error: result.error };

  await logDutyAdminAudit({
    actorId: admin.user.id,
    action: "duty.rule.update",
    entityType: "DutyCalculationRule",
    entityId: params.ruleId,
    afterJson: params,
  });
  revalidatePath("/admin/duty/rules");
  return { ok: true };
}

export async function publishRulesAction(params: {
  ruleIds: string[];
  confirmRegression: boolean;
}): Promise<DutyAdminOsState & { preview?: ReturnType<typeof runVerifiedFixtureRegression> }> {
  const admin = await requireAdmin();
  const config = await ghanaConfig();

  const result = await publishDraftRules({
    countryConfigId: config.countryConfigId,
    ruleIds: params.ruleIds,
    actorId: admin.user.id,
    confirmRegression: params.confirmRegression,
  });

  if (!result.ok) return { error: result.error, preview: result.preview };

  await logDutyAdminAudit({
    actorId: admin.user.id,
    action: "duty.rule.publish",
    entityType: "DutyCalculationRule",
    afterJson: { ruleIds: params.ruleIds, preview: result.preview },
  });

  await dutyCacheInvalidate("duty:");
  revalidatePath("/admin/duty/rules");
  return { ok: true, preview: result.preview };
}

export async function retireRuleAction(ruleId: string): Promise<DutyAdminOsState> {
  const admin = await requireAdmin();
  await retireRule(ruleId);
  await logDutyAdminAudit({
    actorId: admin.user.id,
    action: "duty.rule.retire",
    entityType: "DutyCalculationRule",
    entityId: ruleId,
  });
  revalidatePath("/admin/duty/rules");
  return { ok: true };
}

export async function cloneRuleSetAction(profileId: string | null): Promise<DutyAdminOsState & { count?: number }> {
  const admin = await requireAdmin();
  const config = await ghanaConfig();
  const count = await cloneRuleSet({
    countryConfigId: config.countryConfigId,
    profileId,
    actorId: admin.user.id,
  });
  await logDutyAdminAudit({
    actorId: admin.user.id,
    action: "duty.rule.clone",
    entityType: "DutyCalculationRule",
    afterJson: { profileId, count },
  });
  revalidatePath("/admin/duty/rules");
  return { ok: true, count };
}

export async function verifyAssessmentAction(params: {
  assessmentId: string;
  notes?: string;
  calibrationEligible?: boolean;
}): Promise<DutyAdminOsState> {
  const admin = await requireAdmin();
  await verifyAssessment({ ...params, actorId: admin.user.id });
  await logDutyAdminAudit({
    actorId: admin.user.id,
    action: "duty.assessment.verify",
    entityType: "DutyAssessment",
    entityId: params.assessmentId,
    afterJson: params,
  });
  revalidatePath("/admin/duty/assessments");
  revalidatePath(`/admin/duty/assessments/${params.assessmentId}`);
  return { ok: true };
}

export async function rejectAssessmentAction(params: {
  assessmentId: string;
  reason: string;
}): Promise<DutyAdminOsState> {
  const admin = await requireAdmin();
  await rejectAssessment({ ...params, actorId: admin.user.id });
  await logDutyAdminAudit({
    actorId: admin.user.id,
    action: "duty.assessment.reject",
    entityType: "DutyAssessment",
    entityId: params.assessmentId,
    afterJson: params,
  });
  revalidatePath("/admin/duty/assessments");
  return { ok: true };
}

export async function requestCorrectionAction(params: {
  assessmentId: string;
  reason: string;
}): Promise<DutyAdminOsState> {
  const admin = await requireAdmin();
  if (!params.reason.trim()) return { error: "Correction reason required." };
  await requestAssessmentCorrection({ ...params, actorId: admin.user.id });
  await logDutyAdminAudit({
    actorId: admin.user.id,
    action: "duty.assessment.reject",
    entityType: "DutyAssessment",
    entityId: params.assessmentId,
    afterJson: { type: "correction-requested", reason: params.reason },
  });
  revalidatePath(`/admin/duty/assessments/${params.assessmentId}`);
  return { ok: true };
}

export async function toggleCalibrationEligibilityAction(params: {
  assessmentId: string;
  eligible: boolean;
}): Promise<DutyAdminOsState> {
  const admin = await requireAdmin();
  await setCalibrationEligibility({ ...params, actorId: admin.user.id });
  await logDutyAdminAudit({
    actorId: admin.user.id,
    action: "duty.assessment.calibration.toggle",
    entityType: "DutyAssessment",
    entityId: params.assessmentId,
    afterJson: params,
  });
  revalidatePath(`/admin/duty/assessments/${params.assessmentId}`);
  return { ok: true };
}

export async function updateDutySettingsAction(patch: z.infer<typeof settingsPatchSchema>): Promise<DutyAdminOsState> {
  const admin = await requireAdmin();
  const parsed = settingsPatchSchema.safeParse(patch);
  if (!parsed.success) return { error: "Invalid settings." };

  const config = await ghanaConfig();
  const existing = await prisma.dutyCountryConfig.findUniqueOrThrow({
    where: { id: config.countryConfigId },
    select: { configJson: true },
  });

  const next = mergeDutyAdminSettings(existing.configJson, parsed.data);
  await prisma.dutyCountryConfig.update({
    where: { id: config.countryConfigId },
    data: { configJson: next as object },
  });

  await logDutyAdminAudit({
    actorId: admin.user.id,
    action: "duty.settings.update",
    entityType: "DutyCountryConfig",
    entityId: config.countryConfigId,
    beforeJson: existing.configJson,
    afterJson: next,
  });

  revalidatePath("/admin/duty/settings");
  return { ok: true };
}

export async function runRegressionPreviewAction() {
  await requireAdmin();
  return runVerifiedFixtureRegression();
}

export async function listVehicleProfilesData(searchParams: Record<string, string | string[] | undefined>) {
  await requireAdmin();
  const { page, pageSize } = parsePagination(searchParams, 20);
  const [items, totalItems, allForConflicts] = await Promise.all([
    prisma.dutyVehicleProfile.findMany({
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.dutyVehicleProfile.count(),
    prisma.dutyVehicleProfile.findMany({
      select: {
        id: true,
        make: true,
        model: true,
        manufactureYear: true,
        hsCode: true,
        fuelType: true,
        engineCc: true,
        chassis: true,
      },
      take: 500,
    }),
  ]);
  return {
    items,
    page,
    pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    conflicts: detectProfileConflicts(allForConflicts),
  };
}

export async function createFxRateAction(input: {
  fromCurrency: string;
  toCurrency?: string;
  rate: number;
  effectiveDate: string | Date;
  source: "BANK_OF_GHANA" | "CUSTOMS" | "MANUAL_OVERRIDE" | "GLOBAL_CURRENCY";
  isOverride?: boolean;
  overrideReason?: string;
}): Promise<DutyAdminOsState> {
  const admin = await requireAdmin();
  const validated = validateFxRateInput(input);
  if (!validated.ok) return { error: validated.error };

  const config = await ghanaConfig();
  const row = await prisma.dutyExchangeRate.create({
    data: {
      countryConfigId: config.countryConfigId,
      fromCurrency: validated.data.fromCurrency,
      toCurrency: validated.data.toCurrency,
      rate: validated.data.rate,
      effectiveDate: validated.data.effectiveDate,
      source: validated.data.source,
      isOverride: validated.data.isOverride,
      createdById: admin.user.id,
    },
  });

  await logDutyAdminAudit({
    actorId: admin.user.id,
    action: validated.data.isOverride ? "duty.fx.override" : "duty.fx.create",
    entityType: "DutyExchangeRate",
    entityId: row.id,
    afterJson: { ...validated.data, overrideReason: input.overrideReason },
  });

  await dutyCacheInvalidate("duty:fx:");
  revalidatePath("/admin/duty/fx-rates");
  revalidatePath("/admin/duty");
  return { ok: true, id: row.id };
}

export async function listFxRatesData(searchParams: Record<string, string | string[] | undefined>) {
  await requireAdmin();
  const config = await ghanaConfig();
  const settings = await prisma.dutyCountryConfig.findUnique({
    where: { id: config.countryConfigId },
    select: { configJson: true },
  });
  const staleThresholdDays = parseDutyAdminSettings(settings?.configJson).staleFxThresholdDays;
  const { page, pageSize } = parsePagination(searchParams, 20);
  const [items, totalItems] = await Promise.all([
    prisma.dutyExchangeRate.findMany({
      where: { countryConfigId: config.countryConfigId },
      orderBy: { effectiveDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.dutyExchangeRate.count({ where: { countryConfigId: config.countryConfigId } }),
  ]);
  return { items, page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)), staleThresholdDays };
}

export async function listHsCodesData(searchParams: Record<string, string | string[] | undefined>) {
  await requireAdmin();
  const config = await ghanaConfig();
  const { page, pageSize } = parsePagination(searchParams, 20);
  const [items, totalItems] = await Promise.all([
    prisma.dutyHsCode.findMany({
      where: { countryConfigId: config.countryConfigId },
      orderBy: { hsCode: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.dutyHsCode.count({ where: { countryConfigId: config.countryConfigId } }),
  ]);
  return { items, page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) };
}

export async function getValuationConfigData() {
  await requireAdmin();
  const config = await ghanaConfig();
  const [shipping, insurance] = await Promise.all([
    prisma.dutyShippingCostMatrix.findMany({
      where: { countryConfigId: config.countryConfigId, active: true },
      orderBy: { originCountry: "asc" },
      take: 100,
    }),
    prisma.dutyInsuranceRule.findMany({
      where: { countryConfigId: config.countryConfigId, active: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return { shipping, insurance };
}

export { compareAssessmentToCalculation };
