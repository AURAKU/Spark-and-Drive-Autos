/**
 * Client-side upload to Cloudinary using the app's signed upload endpoint.
 * Used by admin media flows (parts, etc.).
 */
export async function uploadFileToCloudinary(
  file: File,
  folder: string,
  kind: "image" | "video" = "image"
): Promise<{ secure_url: string; public_id: string }> {
  const sigRes = await fetch("/api/upload/cloudinary-signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder, kind }),
  });
  if (sigRes.status === 501) {
    throw new Error("Cloudinary is not configured. Set CLOUDINARY_* env vars.");
  }
  if (!sigRes.ok) throw new Error("Could not sign upload");
  const data = (await sigRes.json()) as {
    timestamp: number;
    signature: string;
    apiKey: string;
    folder: string;
    uploadUrl: string;
  };
  const fd = new FormData();
  fd.append("file", file);
  fd.append("api_key", data.apiKey);
  fd.append("timestamp", String(data.timestamp));
  fd.append("signature", data.signature);
  fd.append("folder", data.folder);
  const up = await fetch(data.uploadUrl, { method: "POST", body: fd });
  if (!up.ok) {
    const err = await up.text();
    throw new Error(err || "Upload failed");
  }
  return up.json() as Promise<{ secure_url: string; public_id: string }>;
}
