import { VerificationDocumentType } from "@prisma/client";

export const ID_VERIFICATION_CONSENT_TEXT =
  "I consent to Spark & Drive Gear collecting and processing my identification document for payment verification, fraud prevention, dispute resolution, sourcing protection, and compliance purposes. I understand that my document will be stored securely and accessed only by authorized personnel.";

/** Customer-facing allowed verification IDs (restricted product scope). */
export const ALLOWED_VERIFICATION_DOCUMENT_TYPES: VerificationDocumentType[] = [
  VerificationDocumentType.GHANA_CARD,
  VerificationDocumentType.PASSPORT,
  VerificationDocumentType.DRIVER_LICENSE,
];
