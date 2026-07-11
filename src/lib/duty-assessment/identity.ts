import { createHash } from "node:crypto";

export type AssessmentIdentityInput = {
  billOfEntryNumber?: string | null;
  customsOffice?: string | null;
  declarationReference?: string | null;
  assessmentDate?: Date | null;
  totalAssessedGhs?: number | null;
  totalPaidGhs?: number | null;
  importerIdentifier?: string | null;
};

function normalizeRef(value?: string | null): string {
  return (value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function formatDateKey(date?: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

function formatAmountKey(amount?: number | null): string {
  if (amount == null || !Number.isFinite(amount)) return "";
  return amount.toFixed(2);
}

/** Hash sensitive importer/taxpayer identifiers — never store raw values in list views. */
export function hashImporterIdentifier(identifier: string): string {
  return createHash("sha256").update(identifier.trim().toUpperCase()).digest("hex");
}

/** Stable deduplication hash for assessments and document uploads. */
export function buildAssessmentIdentityHash(input: AssessmentIdentityInput): string {
  const parts = [
    normalizeRef(input.billOfEntryNumber),
    normalizeRef(input.customsOffice),
    normalizeRef(input.declarationReference),
    formatDateKey(input.assessmentDate),
    formatAmountKey(input.totalAssessedGhs ?? input.totalPaidGhs),
    input.importerIdentifier ? hashImporterIdentifier(input.importerIdentifier) : "",
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export function buildDocumentChecksum(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function normalizeHsCode(hsCode: string): string {
  const digits = hsCode.replace(/\D/g, "");
  if (digits.length === 6) {
    return `${digits.slice(0, 4)}.${digits.slice(4)}`;
  }
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
  }
  return hsCode.trim();
}
