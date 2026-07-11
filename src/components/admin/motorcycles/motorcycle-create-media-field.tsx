"use client";

import Image from "next/image";
import { Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { VehicleCoverImage } from "@/components/cars/vehicle-cover-image";
import { inventoryVideoMaxSizeLabel, uploadFileToCloudinary } from "@/lib/cloudinary-upload-client";

export type MotorcycleCreateMediaState = {
  coverUrl: string;
  coverPublicId: string;
  extraImages: File[];
  videos: File[];
};

type Props = {
  value: MotorcycleCreateMediaState;
  onChange: (next: MotorcycleCreateMediaState) => void;
};

type QueuedPreview = { key: string; file: File; preview: string };

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export function MotorcycleCreateMediaField({ value, onChange }: Props) {
  const [uploadingCover, setUploadingCover] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<QueuedPreview[]>([]);
  const [videoPreviews, setVideoPreviews] = useState<QueuedPreview[]>([]);

  useEffect(() => {
    const next = value.extraImages.map((file) => ({
      key: fileKey(file),
      file,
      preview: URL.createObjectURL(file),
    }));
    setImagePreviews((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.preview));
      return next;
    });
    return () => next.forEach((p) => URL.revokeObjectURL(p.preview));
  }, [value.extraImages]);

  useEffect(() => {
    const next = value.videos.map((file) => ({
      key: fileKey(file),
      file,
      preview: URL.createObjectURL(file),
    }));
    setVideoPreviews((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.preview));
      return next;
    });
    return () => next.forEach((p) => URL.revokeObjectURL(p.preview));
  }, [value.videos]);

  const hasCover = Boolean(value.coverUrl.trim());

  async function uploadCover(file: File) {
    setUploadingCover(true);
    try {
      const uploaded = await uploadFileToCloudinary(file, "motorcycles", "image");
      onChange({ ...value, coverUrl: uploaded.secure_url, coverPublicId: uploaded.public_id });
      toast.success("Cover photo uploaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cover upload failed.");
    } finally {
      setUploadingCover(false);
    }
  }

  function addExtraImages(files: FileList | null) {
    if (!files?.length) return;
    const merged = [...value.extraImages];
    for (const file of Array.from(files)) {
      if (!merged.some((f) => fileKey(f) === fileKey(file))) merged.push(file);
    }
    onChange({ ...value, extraImages: merged });
  }

  function addVideos(files: FileList | null) {
    if (!files?.length) return;
    const merged = [...value.videos];
    for (const file of Array.from(files)) {
      if (!merged.some((f) => fileKey(f) === fileKey(file))) merged.push(file);
    }
    onChange({ ...value, videos: merged });
  }

  function removeExtraImage(key: string) {
    onChange({ ...value, extraImages: value.extraImages.filter((f) => fileKey(f) !== key) });
  }

  function removeVideo(key: string) {
    onChange({ ...value, videos: value.videos.filter((f) => fileKey(f) !== key) });
  }

  const coverLabel = useMemo(
    () => (uploadingCover ? "Uploading cover…" : hasCover ? "Replace cover photo" : "Upload cover photo"),
    [uploadingCover, hasCover],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border p-4 dark:border-white/10">
        <h3 className="text-sm font-semibold">Cover photo *</h3>
        <p className="mt-1 text-xs text-muted-foreground">Upload from your device — same flow as cars and parts inventory.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50 dark:border-white/15">
            <Upload className="size-4" />
            {coverLabel}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploadingCover}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadCover(file);
                e.target.value = "";
              }}
            />
          </label>
          {hasCover && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => onChange({ ...value, coverUrl: "", coverPublicId: "" })}
            >
              Clear cover
            </button>
          )}
        </div>
        {hasCover && (
          <div className="relative mt-4 aspect-[4/3] w-full max-w-sm overflow-hidden rounded-lg border border-border dark:border-white/10">
            <VehicleCoverImage src={value.coverUrl} alt="Cover preview" fill className="object-cover" sizes="320px" deliveryPreset="card" />
          </div>
        )}
        <label className="mt-4 block text-xs text-muted-foreground">
          Or paste image URL
          <input
            value={value.coverUrl}
            onChange={(e) => onChange({ ...value, coverUrl: e.target.value, coverPublicId: "" })}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-white/15"
            placeholder="https://res.cloudinary.com/…"
          />
        </label>
      </div>

      <div className="rounded-xl border border-border p-4 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Gallery photos</h3>
            <p className="mt-1 text-xs text-muted-foreground">Optional — uploaded when you publish.</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50 dark:border-white/15">
            <Upload className="size-4" />
            Add photos
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { addExtraImages(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
        {imagePreviews.length > 0 && (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {imagePreviews.map((item) => (
              <li key={item.key} className="relative overflow-hidden rounded-lg border border-border dark:border-white/10">
                <div className="relative aspect-[4/3]">
                  <Image src={item.preview} alt="" fill className="object-cover" sizes="160px" unoptimized />
                </div>
                <button type="button" className="absolute right-1 top-1 rounded bg-black/70 p-1 text-white" onClick={() => removeExtraImage(item.key)} aria-label="Remove photo">
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-border p-4 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Videos</h3>
            <p className="mt-1 text-xs text-muted-foreground">Optional walkthrough clips. Max {inventoryVideoMaxSizeLabel()} each.</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50 dark:border-white/15">
            <Upload className="size-4" />
            Add video
            <input type="file" accept="video/*" className="sr-only" onChange={(e) => { addVideos(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
        {videoPreviews.length > 0 && (
          <ul className="mt-4 space-y-2">
            {videoPreviews.map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm dark:border-white/10">
                <span className="truncate text-muted-foreground">{item.file.name}</span>
                <button type="button" className="shrink-0 text-xs text-destructive hover:underline" onClick={() => removeVideo(item.key)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export async function uploadQueuedMotorcycleMedia(
  motorcycleId: string,
  media: Pick<MotorcycleCreateMediaState, "extraImages" | "videos">,
): Promise<void> {
  const { addMotorcycleImage, addMotorcycleVideo } = await import("@/actions/motorcycle-media");
  for (const file of media.extraImages) {
    const uploaded = await uploadFileToCloudinary(file, "motorcycles", "image");
    const result = await addMotorcycleImage(motorcycleId, { url: uploaded.secure_url, publicId: uploaded.public_id });
    if (result.error) throw new Error(result.error);
  }
  for (const file of media.videos) {
    const uploaded = await uploadFileToCloudinary(file, "motorcycles", "video");
    const result = await addMotorcycleVideo(motorcycleId, {
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      mimeType: file.type || null,
    });
    if (result.error) throw new Error(result.error);
  }
}
