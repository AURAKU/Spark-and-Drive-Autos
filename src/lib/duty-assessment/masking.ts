import type { AssessmentListMaskOptions, MaskedAssessmentSummary } from "./types";

export function maskVin(vin: string | null | undefined): string | null {
  if (!vin) return null;
  const trimmed = vin.trim();
  if (trimmed.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

export function maskChassis(chassis: string | null | undefined): string | null {
  return maskVin(chassis);
}

export function maskBillOfEntry(boe: string | null | undefined): string | null {
  if (!boe) return null;
  const trimmed = boe.trim();
  if (trimmed.length <= 6) return "***";
  return `${trimmed.slice(0, 3)}***${trimmed.slice(-3)}`;
}

export function maskDeclarationReference(ref: string | null | undefined): string | null {
  return maskBillOfEntry(ref);
}

export function maskPaymentReference(ref: string | null | undefined): string | null {
  if (!ref) return null;
  if (ref.length <= 8) return "****";
  return `${ref.slice(0, 4)}****${ref.slice(-4)}`;
}

export function toMaskedAssessmentSummary(
  row: {
    id: string;
    billOfEntryNumber: string | null;
    declarationReference: string | null;
    assessmentStatus: MaskedAssessmentSummary["assessmentStatus"];
    verificationStatus: MaskedAssessmentSummary["verificationStatus"];
    totalAssessedGhs: { toString(): string } | number;
    totalPaidGhs: { toString(): string } | number | null;
    assessmentDate: Date | null;
  },
  options: AssessmentListMaskOptions = { maskBillOfEntry: true },
): MaskedAssessmentSummary {
  return {
    id: row.id,
    billOfEntryNumber: options.maskBillOfEntry ? maskBillOfEntry(row.billOfEntryNumber) : row.billOfEntryNumber,
    declarationReference: options.maskBillOfEntry ? maskDeclarationReference(row.declarationReference) : row.declarationReference,
    assessmentStatus: row.assessmentStatus,
    verificationStatus: row.verificationStatus,
    totalAssessedGhs: Number(row.totalAssessedGhs),
    totalPaidGhs: row.totalPaidGhs != null ? Number(row.totalPaidGhs) : null,
    assessmentDate: row.assessmentDate,
  };
}
