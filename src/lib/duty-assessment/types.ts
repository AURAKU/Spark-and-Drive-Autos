import type {
  DutyAssessmentSourceKind,
  DutyAssessmentStatus,
  DutyEvidenceKind,
  DutyFuelType,
  DutyVerificationStatus,
  DutyVehicleCategory,
} from "@prisma/client";

export type AssessmentLineInput = {
  chargeCode?: string;
  chargeName: string;
  externalTaxCode?: string;
  taxBaseCode?: string;
  displayedBaseAmount?: number;
  displayedRate?: number;
  amountExempted?: number;
  amountSuspended?: number;
  amountPayable: number;
  displayOrder?: number;
  sourcePage?: number;
  sourceRow?: number;
  sourceDocumentKind?: DutyEvidenceKind;
};

export type VehicleProfileInput = {
  make: string;
  model: string;
  manufacturerModel?: string;
  vin?: string;
  chassis?: string;
  manufactureYear: number;
  manufactureMonth?: number;
  firstRegistrationDate?: Date;
  vehicleCategory?: DutyVehicleCategory;
  fuelType: DutyFuelType;
  engineCc?: number;
  powerKw?: number;
  cylinders?: number;
  seats?: number;
  grossWeightKg?: number;
  netWeightKg?: number;
  hsCode: string;
  countryOfOrigin?: string;
  countryOfExport?: string;
};

export type BillOfEntryIngestInput = {
  countryConfigId?: string;
  vehicle: VehicleProfileInput;
  customsOffice?: string;
  declarationReference?: string;
  billOfEntryNumber?: string;
  assessmentDate?: Date;
  currency?: string;
  fobForeign?: number;
  fobForeignCurrency?: string;
  fxRate?: number;
  fobGhs?: number;
  freightGhs?: number;
  insuranceGhs?: number;
  customsValueGhs: number;
  depreciationPercent?: number;
  totalAssessedGhs: number;
  importerIdentifier?: string;
  lines: AssessmentLineInput[];
  document?: EvidenceDocumentInput;
  notes?: string;
  sourceKind?: DutyAssessmentSourceKind;
  verificationStatus?: DutyVerificationStatus;
};

export type PaymentReceiptIngestInput = {
  billOfEntryNumber?: string;
  customsOffice?: string;
  declarationReference?: string;
  assessmentDate?: Date;
  paymentDate?: Date;
  totalPaidGhs: number;
  importerIdentifier?: string;
  lines?: AssessmentLineInput[];
  document: EvidenceDocumentInput;
  notes?: string;
};

export type EvidenceDocumentInput = {
  documentKind: DutyEvidenceKind;
  secureStorageKey: string;
  checksum: string;
  originalFilename: string;
  mimeType: string;
  documentDate?: Date;
  fileUrl?: string;
};

export type IngestBillOfEntryResult = {
  assessmentId: string;
  vehicleProfileId: string;
  documentId?: string;
  lineCount: number;
  totalAssessedGhs: number;
  duplicatePrevented: boolean;
};

export type AttachReceiptResult = {
  assessmentId: string;
  matchedExisting: boolean;
  totalPaidGhs: number;
  varianceGhs: number | null;
  unmatchedReceiptLines: string[];
  duplicatePrevented: boolean;
};

export type ReconciliationResult = {
  matchedKeys: string[];
  unmatchedReceiptLines: AssessmentLineInput[];
  duplicateKeysPrevented: string[];
  totalPayableFromLines: number;
};

export type AssessmentListMaskOptions = {
  maskVin?: boolean;
  maskChassis?: boolean;
  maskBillOfEntry?: boolean;
};

export type MaskedAssessmentSummary = {
  id: string;
  billOfEntryNumber: string | null;
  declarationReference: string | null;
  assessmentStatus: DutyAssessmentStatus;
  verificationStatus: DutyVerificationStatus;
  totalAssessedGhs: number;
  totalPaidGhs: number | null;
  assessmentDate: Date | null;
};
