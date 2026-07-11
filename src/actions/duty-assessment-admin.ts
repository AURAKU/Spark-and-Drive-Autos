"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logDutyAssessmentAudit } from "@/lib/duty-assessment/audit";
import {
  archiveEvidenceDocument,
  attachPaymentReceipt,
  ingestBillOfEntry,
} from "@/lib/duty-assessment/ingestion";
import type { BillOfEntryIngestInput, PaymentReceiptIngestInput } from "@/lib/duty-assessment/types";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export type DutyAssessmentActionState = { ok?: boolean; error?: string; assessmentId?: string };

const billOfEntrySchema = z.object({
  billOfEntryNumber: z.string().trim().min(3).max(64),
  customsOffice: z.string().trim().min(2).max(120),
  totalAssessedGhs: z.coerce.number().positive(),
  customsValueGhs: z.coerce.number().positive(),
});

export async function ingestBillOfEntryAction(
  input: BillOfEntryIngestInput,
): Promise<DutyAssessmentActionState & { duplicatePrevented?: boolean }> {
  try {
    const session = await requireAdmin();
    const result = await prisma.$transaction(async (tx) => {
      const ingested = await ingestBillOfEntry(tx, input, session.user.id);
      await logDutyAssessmentAudit({
        actorId: session.user.id,
        action: "duty.assessment.boe.ingest",
        entityType: "DutyAssessment",
        entityId: ingested.assessmentId,
        afterJson: ingested,
      });
      return ingested;
    });
    revalidatePath("/admin/duty-intelligence");
    return { ok: true, assessmentId: result.assessmentId, duplicatePrevented: result.duplicatePrevented };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { error: "Admin only." };
    return { error: e instanceof Error ? e.message : "Bill of Entry ingestion failed." };
  }
}

export async function attachPaymentReceiptAction(
  input: PaymentReceiptIngestInput,
): Promise<DutyAssessmentActionState & { duplicatePrevented?: boolean; unmatchedReceiptLines?: string[] }> {
  try {
    const session = await requireAdmin();
    const parsed = billOfEntrySchema.partial().safeParse(input);
    if (!parsed.success && !input.billOfEntryNumber) {
      return { error: "Receipt must reference a Bill of Entry number or matching identity." };
    }

    const result = await prisma.$transaction(async (tx) => {
      const attached = await attachPaymentReceipt(tx, input, session.user.id);
      await logDutyAssessmentAudit({
        actorId: session.user.id,
        action: "duty.assessment.receipt.attach",
        entityType: "DutyAssessment",
        entityId: attached.assessmentId,
        afterJson: attached,
      });
      return attached;
    });
    revalidatePath("/admin/duty-intelligence");
    return {
      ok: true,
      assessmentId: result.assessmentId,
      duplicatePrevented: result.duplicatePrevented,
      unmatchedReceiptLines: result.unmatchedReceiptLines,
    };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { error: "Admin only." };
    return { error: e instanceof Error ? e.message : "Receipt attachment failed." };
  }
}

export async function archiveEvidenceDocumentAction(
  documentId: string,
  reason: string,
): Promise<DutyAssessmentActionState> {
  try {
    const session = await requireAdmin();
    await prisma.$transaction(async (tx) => {
      await archiveEvidenceDocument(tx, {
        documentId,
        actorId: session.user.id,
        reason,
      });
      await logDutyAssessmentAudit({
        actorId: session.user.id,
        action: "duty.assessment.document.archive",
        entityType: "DutyEvidenceDocument",
        entityId: documentId,
        afterJson: { reason },
      });
    });
    revalidatePath("/admin/duty-intelligence");
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { error: "Admin only." };
    return { error: e instanceof Error ? e.message : "Could not archive document." };
  }
}
