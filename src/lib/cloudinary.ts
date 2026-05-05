import { v2 as cloudinary } from "cloudinary";

import { CLOUDINARY_USER_MESSAGE } from "@/lib/cloudinary-config-public";

/** Internal error code for missing server env (never send secret to client). */
export const CLOUDINARY_NOT_CONFIGURED = "CLOUDINARY_NOT_CONFIGURED";

export { CLOUDINARY_USER_MESSAGE };

export type CloudinaryServerCredentials = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

const ALLOWED_FOLDER_PREFIXES = [
  "sda/payments/",
  "sda/part-sourcing/",
  "sda/chat/",
  "sda/profile/",
  "sda/admin/",
  "sda/verification/",
  "sda/users/",
  /** Vehicle media from admin */
  "sda/cars/",
  /** Legacy part image folders */
  "spark-drive/",
] as const;

function assertSafeFolder(folder: string) {
  const normalized = folder.trim();
  if (!/^[a-z0-9/_-]{3,180}$/i.test(normalized)) {
    throw new Error("Unsafe upload folder.");
  }
  if (!ALLOWED_FOLDER_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    throw new Error("Folder is not allowed for signed upload.");
  }
}

/** True when all three server credentials are present (does not validate they work). */
export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim(),
  );
}

/**
 * Requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
 * @throws Error with message CLOUDINARY_NOT_CONFIGURED
 */
export function requireCloudinaryCredentials(): CloudinaryServerCredentials {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) {
    const err = new Error(CLOUDINARY_NOT_CONFIGURED);
    (err as Error & { code?: string }).code = CLOUDINARY_NOT_CONFIGURED;
    throw err;
  }
  return { cloudName, apiKey, apiSecret };
}

/**
 * Configures the Cloudinary Node SDK for signing. Returns false if credentials are incomplete.
 */
export function configureCloudinary(): boolean {
  if (!isCloudinaryConfigured()) return false;
  try {
    const { cloudName, apiKey, apiSecret } = requireCloudinaryCredentials();
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    return true;
  } catch {
    return false;
  }
}

export function isCloudinaryMissingConfigError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return e.message === CLOUDINARY_NOT_CONFIGURED || (e as Error & { code?: string }).code === CLOUDINARY_NOT_CONFIGURED;
}

/**
 * Standard sign payload returned to clients (never includes apiSecret).
 */
export type CloudinaryClientSignPayload = {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
};

export async function createUploadSignature(params: {
  folder: string;
  publicId?: string;
  timestamp?: number;
}): Promise<CloudinaryClientSignPayload> {
  assertSafeFolder(params.folder);
  if (!configureCloudinary()) {
    const err = new Error(CLOUDINARY_NOT_CONFIGURED);
    (err as Error & { code?: string }).code = CLOUDINARY_NOT_CONFIGURED;
    throw err;
  }
  const creds = requireCloudinaryCredentials();
  const timestamp = params.timestamp ?? Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { folder: params.folder, timestamp, ...(params.publicId ? { public_id: params.publicId } : {}) },
    creds.apiSecret,
  );
  return {
    timestamp,
    signature,
    apiKey: creds.apiKey,
    cloudName: creds.cloudName,
    folder: params.folder,
  };
}

export type PaymentProofUploadKind = "image" | "pdf";

const GHANA_CARD_IMAGE_MIMES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

/**
 * Signed upload to Cloudinary `auto` (detects image / video / raw). Sign params: folder + timestamp only.
 */
export function createAutoFolderUploadSignature(params: { folder: string }) {
  assertSafeFolder(params.folder);
  if (!configureCloudinary()) {
    const err = new Error(CLOUDINARY_NOT_CONFIGURED);
    (err as Error & { code?: string }).code = CLOUDINARY_NOT_CONFIGURED;
    throw err;
  }
  const creds = requireCloudinaryCredentials();
  const folder = params.folder.trim();
  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request({ folder, timestamp }, creds.apiSecret);
  return {
    timestamp,
    signature,
    cloudName: creds.cloudName,
    apiKey: creds.apiKey,
    folder,
    uploadUrl: `https://api.cloudinary.com/v1_1/${creds.cloudName}/auto/upload`,
  };
}

export async function createGhanaCardClientUploadSignature(params: { folder: string; mimeType: string }) {
  assertSafeFolder(params.folder);
  const mime = params.mimeType.trim().toLowerCase();
  const isPdf = mime === "application/pdf";
  const isImage = GHANA_CARD_IMAGE_MIMES.has(mime);
  if (!isPdf && !isImage) {
    throw new Error("Unsupported file type for Ghana Card upload.");
  }
  return createAutoFolderUploadSignature({ folder: params.folder });
}

export async function createPaymentProofUploadSignature(params: {
  folder: string;
  kind: PaymentProofUploadKind;
}) {
  assertSafeFolder(params.folder);
  if (!configureCloudinary()) {
    const err = new Error(CLOUDINARY_NOT_CONFIGURED);
    (err as Error & { code?: string }).code = CLOUDINARY_NOT_CONFIGURED;
    throw err;
  }
  const creds = requireCloudinaryCredentials();
  const timestamp = Math.round(Date.now() / 1000);
  const folder = params.folder;

  if (params.kind === "pdf") {
    const toSign: Record<string, string | number> = { folder, timestamp };
    const signature = cloudinary.utils.api_sign_request(toSign, creds.apiSecret);
    return {
      timestamp,
      signature,
      cloudName: creds.cloudName,
      apiKey: creds.apiKey,
      folder,
      uploadUrl: `https://api.cloudinary.com/v1_1/${creds.cloudName}/raw/upload`,
      kind: "pdf" as const,
      eager: null as string | null,
    };
  }

  const eager = "c_limit,w_2000,q_auto:good,f_auto";
  const toSign: Record<string, string | number> = { folder, timestamp, eager };
  const signature = cloudinary.utils.api_sign_request(toSign, creds.apiSecret);
  return {
    timestamp,
    signature,
    cloudName: creds.cloudName,
    apiKey: creds.apiKey,
    folder,
    uploadUrl: `https://api.cloudinary.com/v1_1/${creds.cloudName}/image/upload`,
    kind: "image" as const,
    eager,
  };
}
