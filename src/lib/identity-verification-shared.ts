import { VerificationDocumentType } from "@prisma/client";

export const ID_VERIFICATION_CONSENT_TEXT =
  "Spark & Drive Autos does not collect photographs of a Ghana Card, passport, or driver's licence, and does not collect a selfie holding an identity document. Where Ghana law requires an identity check, it is done through the National Identification Authority.";

/** Customer photo KYC is closed. Identity documents are not uploaded on this shop. */
export const ALLOWED_VERIFICATION_DOCUMENT_TYPES: VerificationDocumentType[] = [];
