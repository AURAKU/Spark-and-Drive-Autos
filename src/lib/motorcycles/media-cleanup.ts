/**
 * Best-effort Cloudinary asset cleanup.
 * Never throws into the write path — orphans are preferable to failed deletes.
 */
export async function destroyCloudinaryAsset(publicId: string | null | undefined): Promise<void> {
  const id = publicId?.trim();
  if (!id) return;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) return;

  try {
    const { v2: cloudinary } = await import("cloudinary");
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    await cloudinary.uploader.destroy(id, { invalidate: true, resource_type: "image" });
  } catch (e) {
    console.warn("[destroyCloudinaryAsset] image destroy failed", id, e);
    try {
      const { v2: cloudinary } = await import("cloudinary");
      await cloudinary.uploader.destroy(id, { invalidate: true, resource_type: "video" });
    } catch (e2) {
      console.warn("[destroyCloudinaryAsset] video destroy failed", id, e2);
    }
  }
}

export async function destroyCloudinaryVideoAsset(publicId: string | null | undefined): Promise<void> {
  const id = publicId?.trim();
  if (!id) return;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) return;
  try {
    const { v2: cloudinary } = await import("cloudinary");
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    await cloudinary.uploader.destroy(id, { invalidate: true, resource_type: "video" });
  } catch (e) {
    console.warn("[destroyCloudinaryVideoAsset] failed", id, e);
  }
}
