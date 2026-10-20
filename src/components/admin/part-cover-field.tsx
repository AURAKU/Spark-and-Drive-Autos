"use client";

import { useState } from "react";
import { toast } from "sonner";

import { InventoryMediaSourcePicker } from "@/components/admin/inventory-media-source-picker";
import { VehicleCoverImage } from "@/components/cars/vehicle-cover-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadFileToCloudinary } from "@/lib/cloudinary-upload-client";

type Props = {
  initialUrl?: string | null;
  initialPublicId?: string | null;
};

/** Cover upload on create. After the part is saved, use the full media panel for more photos and videos. */
export function PartCoverField({ initialUrl, initialPublicId }: Props) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [publicId, setPublicId] = useState(initialPublicId ?? "");
  const [uploading, setUploading] = useState(false);

  async function onFilesReady(files: File[]) {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    try {
      const json = await uploadFileToCloudinary(file, "sda/admin/parts/cover", "image");
      setUrl(json.secure_url);
      setPublicId(json.public_id);
      toast.success(files.length > 1 ? "Cover set. Add the rest after you create the part." : "Cover image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="coverImageUrl" value={url} readOnly />
      <input type="hidden" name="coverImagePublicId" value={publicId} readOnly />
      <div>
        <Label>Cover image</Label>
        <p className="mt-1 text-xs text-zinc-500">
          Upload a cover now. After you create the part, open Edit to add multiple photos and videos.
        </p>
        <div className="mt-3">
          <InventoryMediaSourcePicker
            kind="image"
            multiple
            disabled={uploading}
            uploadLabel={uploading ? "Uploading…" : "Add cover photo"}
            onFilesReady={onFilesReady}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="cover-url-manual">Image URL (optional override)</Label>
        <Input
          id="cover-url-manual"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="mt-1"
        />
      </div>
      {url ? (
        <div className="relative h-40 w-full max-w-xs overflow-hidden rounded-xl border border-white/10 bg-black/30">
          <VehicleCoverImage
            src={url}
            alt=""
            fill
            className="object-cover"
            sizes="320px"
            deliveryPreset="card"
          />
        </div>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-white/15"
        onClick={() => {
          setUrl("");
          setPublicId("");
        }}
      >
        Clear cover
      </Button>
    </div>
  );
}
