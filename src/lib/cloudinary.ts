import { v2 as cloudinary } from "cloudinary";

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
