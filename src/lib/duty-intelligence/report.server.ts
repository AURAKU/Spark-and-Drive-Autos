import "server-only";

import { isAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";
import { signDutyReportAccessToken, verifyDutyReportAccessToken } from "@/lib/duty-intelligence/report-access";
import { buildDutyReportData, type DutyReportData } from "@/lib/duty-intelligence/report-model";
import { saveDutyCalculation } from "@/lib/duty-intelligence/pipeline";
import type { DutyCalculationInput, DutyIntelligenceResult } from "@/lib/duty-intelligence/types";
import { dutyCalculationInputSchema } from "@/lib/duty-intelligence/types";

export type EnsureDutyReportResult =
  | { ok: true; id: string; referenceNumber: string; accessToken: string; reportUrl: string }
  | { ok: false; error: string };

export async function ensureDutyReportCalculation(params: {
  input: DutyCalculationInput;
  result: DutyIntelligenceResult;
}): Promise<EnsureDutyReportResult> {
  const parsed = dutyCalculationInputSchema.safeParse(params.input);
  if (!parsed.success) return { ok: false, error: "Invalid calculation input." };
  if (!params.result?.summary || !Array.isArray(params.result.lineItems)) {
    return { ok: false, error: "Calculation result is incomplete." };
  }

  try {
    const session = await safeAuth();
    const saved = await saveDutyCalculation({
      input: parsed.data,
      result: params.result,
      createdById: session?.user?.id,
      status: "SAVED",
    });
    const accessToken = signDutyReportAccessToken(saved.id);
    return {
      ok: true,
      id: saved.id,
      referenceNumber: saved.referenceNumber,
      accessToken,
      reportUrl: `/duty-report/${saved.id}?access=${encodeURIComponent(accessToken)}`,
    };
  } catch (e) {
    console.error("[ensureDutyReportCalculation]", e instanceof Error ? e.message : e);
    return { ok: false, error: "Could not prepare the report. Please try again." };
  }
}

export type DutyReportLoadResult =
  | { ok: true; report: DutyReportData }
  | { ok: false; status: 401 | 403 | 404; error: string };

export async function loadAuthorizedDutyReport(
  calculationId: string,
  accessToken?: string | null,
): Promise<DutyReportLoadResult> {
  if (!calculationId?.trim()) {
    return { ok: false, status: 404, error: "Report not found." };
  }

  const row = await prisma.dutyCalculation.findUnique({
    where: { id: calculationId },
    select: {
      id: true,
      referenceNumber: true,
      createdAt: true,
      createdById: true,
      inputJson: true,
      resultJson: true,
      createdBy: { select: { name: true, email: true, phone: true } },
    },
  });

  if (!row) return { ok: false, status: 404, error: "Report not found." };

  const session = await safeAuth();
  const isAdmin = session?.user?.role ? isAdminRole(session.user.role) : false;
  const isOwner = Boolean(session?.user?.id && row.createdById && session.user.id === row.createdById);
  const hasToken = verifyDutyReportAccessToken(accessToken, row.id);

  if (!isAdmin && !isOwner && !hasToken) {
    return { ok: false, status: 403, error: "You are not authorized to view this report." };
  }

  try {
    const report = buildDutyReportData({
      calculationId: row.id,
      reportReference: row.referenceNumber,
      generatedAt: row.createdAt,
      preparedBy: row.createdBy?.name ?? "Spark & Drive Autos",
      customer: isAdmin || isOwner
        ? {
            name: row.createdBy?.name ?? null,
            email: row.createdBy?.email ?? null,
            phone: row.createdBy?.phone ?? null,
          }
        : { name: null, email: null, phone: null },
      inputJson: row.inputJson,
      resultJson: row.resultJson,
      website: process.env.AUTH_URL?.replace(/\/$/, "") || process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "https://www.sparkanddriveautos.com",
    });
    return { ok: true, report };
  } catch (e) {
    console.error("[loadAuthorizedDutyReport]", e instanceof Error ? e.message : e);
    return { ok: false, status: 404, error: "This report could not be loaded." };
  }
}
