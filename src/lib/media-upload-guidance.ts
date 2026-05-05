/** User-facing copy and limits for uploads (identity, proofs). Keep in sync with API validators where possible. */

export const MEDIA_UPLOAD_GUIDANCE = {
  identity: {
    images: "JPG, PNG, or WebP up to 10 MB.",
    pdf: "PDF up to 10 MB.",
    combined: "Use JPG, PNG, WebP, or PDF. Maximum file size 10 MB per file.",
  },
  paymentProof: {
    images: "JPG, PNG, or WebP — optimized on upload when possible.",
    pdf: "PDF receipt or bank confirmation.",
  },
} as const;

export const MAX_IDENTITY_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_PAYMENT_PROOF_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_PAYMENT_PROOF_PDF_BYTES = 8 * 1024 * 1024;
