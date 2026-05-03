import { v2 as cloudinary } from "cloudinary";

const ALLOWED_FOLDER_PREFIXES = [
  "sda/payments/",
  "sda/part-sourcing/",
  "sda/chat/",
  "sda/profile/",
  "sda/admin/",
  "sda/verification/",
  /** Per-user Ghana Card and profile uploads (see profile-id-signature, uploads/sign). */
  "sda/users/",
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

export function configureCloudinary() {
  const name = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!name || !key || !secret) return false;
  cloudinary.config({ cloud_name: name, api_key: key, api_secret: secret });
  return true;
}

export async function createUploadSignature(params: {
  folder: string;
  publicId?: string;
  timestamp?: number;
}) {
  assertSafeFolder(params.folder);
  if (!configureCloudinary()) throw new Error("Cloudinary is not configured");
  const timestamp = params.timestamp ?? Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { folder: params.folder, timestamp, public_id: params.publicId },
    process.env.CLOUDINARY_API_SECRET!
  );
  return {
    timestamp,
    signature,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    folder: params.folder,
  };
}

export type PaymentProofUploadKind = "image" | "pdf";

/**
 * Signed direct upload for payment proof: images (with on-upload optimization) or raw PDF.
 * Client must POST the same params to Cloudinary that were included in the signature.
 */
const GHANA_CARD_IMAGE_MIMES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

/**
 * Ghana Card / ID upload from customer dashboard: image or PDF scan.
 * Client must POST the same signed params (folder, timestamp, signature, api_key, file) to `uploadUrl`.
 */
export async function createGhanaCardClientUploadSignature(params: { folder: string; mimeType: string }) {
  assertSafeFolder(params.folder);
  if (!configureCloudinary()) throw new Error("Cloudinary is not configured");
  const mime = params.mimeType.trim().toLowerCase();
  const isPdf = mime === "application/pdf";
  const isImage = GHANA_CARD_IMAGE_MIMES.has(mime);
  if (!isPdf && !isImage) {
    throw new Error("Unsupported file type for Ghana Card upload.");
  }
  const timestamp = Math.round(Date.now() / 1000);
  const folder = params.folder;
  const cloud = process.env.CLOUDINARY_CLOUD_NAME!;
  /** `resource_type` is in the URL only — do not include it in `api_sign_request` (Cloudinary auth rules). */
  const toSign: Record<string, string | number> = { folder, timestamp };
  const signature = cloudinary.utils.api_sign_request(toSign, process.env.CLOUDINARY_API_SECRET!);
  return {
    timestamp,
    signature,
    cloudName: cloud,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    folder,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloud}/auto/upload`,
  };
}

export async function createPaymentProofUploadSignature(params: {
  folder: string;
  kind: PaymentProofUploadKind;
}) {
  assertSafeFolder(params.folder);
  if (!configureCloudinary()) throw new Error("Cloudinary is not configured");
  const timestamp = Math.round(Date.now() / 1000);
  const folder = params.folder;
  const cloud = process.env.CLOUDINARY_CLOUD_NAME!;

  if (params.kind === "pdf") {
    const toSign: Record<string, string | number> = { folder, timestamp };
    const signature = cloudinary.utils.api_sign_request(toSign, process.env.CLOUDINARY_API_SECRET!);
    return {
      timestamp,
      signature,
      cloudName: cloud,
      apiKey: process.env.CLOUDINARY_API_KEY!,
      folder,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloud}/raw/upload`,
      kind: "pdf" as const,
      eager: null as string | null,
    };
  }

  const eager = "c_limit,w_2000,q_auto:good,f_auto";
  const toSign: Record<string, string | number> = { folder, timestamp, eager };
  const signature = cloudinary.utils.api_sign_request(toSign, process.env.CLOUDINARY_API_SECRET!);
  return {
    timestamp,
    signature,
    cloudName: cloud,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    folder,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
    kind: "image" as const,
    eager,
  };
}
