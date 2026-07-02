"use client";

import type { MotorcycleImage, MotorcycleVideo } from "@prisma/client";
import { Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  addMotorcycleImage,
  addMotorcycleVideo,
  deleteMotorcycleImage,
  deleteMotorcycleVideo,
} from "@/actions/motorcycle-media";
import { Button } from "@/components/ui/button";
import { optimizeCloudinaryUrl } from "@/lib/cloudinary-delivery";
import { inventoryVideoMaxSizeLabel, uploadFileToCloudinary } from "@/lib/cloudinary-upload-client";

type Props = {
  motorcycleId: string;
  images: Pick<MotorcycleImage, "id" | "url" | "sortOrder" | "isCover" | "publicId">[];
  videos: Pick<MotorcycleVideo, "id" | "url" | "sortOrder" | "thumbnailUrl" | "publicId" | "mimeType">[];
};

export function MotorcycleMediaPanel({ motorcycleId, images, videos }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingVideos, setUploadingVideos] = useState(false);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function onImageFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploadingImages(true);
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploadFileToCloudinary(file, "motorcycles", "image");
        const result = await addMotorcycleImage(motorcycleId, {
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
        });
        if (result.error) throw new Error(result.error);
      }
      toast.success("Photos uploaded.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploadingImages(false);
    }
  }

  async function onVideoFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploadingVideos(true);
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploadFileToCloudinary(file, "motorcycles", "video");
        const result = await addMotorcycleVideo(motorcycleId, {
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
          mimeType: file.type || null,
        });
        if (result.error) throw new Error(result.error);
      }
      toast.success("Videos uploaded.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploadingVideos(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Photos</h3>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5">
            <Upload className="size-3.5" />
            {uploadingImages ? "Uploading…" : "Add photos"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={uploadingImages}
              onChange={(e) => void onImageFiles(e.target.files)}
            />
          </label>
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img) => (
            <li key={img.id} className="relative overflow-hidden rounded-lg border border-white/10">
              <div className="relative aspect-[4/3]">
                <Image
                  src={optimizeCloudinaryUrl(img.url, "card")}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="160px"
                />
              </div>
              <button
                type="button"
                className="absolute right-1 top-1 rounded bg-black/70 p-1 text-zinc-200 hover:text-red-300"
                onClick={async () => {
                  const r = await deleteMotorcycleImage(img.id);
                  if (r.error) toast.error(r.error);
                  else {
                    toast.success("Removed.");
                    refresh();
                  }
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Videos</h3>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5">
            <Upload className="size-3.5" />
            {uploadingVideos ? "Uploading…" : "Add video"}
            <input
              type="file"
              accept="video/*"
              className="sr-only"
              disabled={uploadingVideos}
              onChange={(e) => void onVideoFiles(e.target.files)}
            />
          </label>
        </div>
        <p className="mt-1 text-[10px] text-zinc-500">Max {inventoryVideoMaxSizeLabel()} per clip.</p>
        <ul className="mt-4 space-y-2">
          {videos.map((v) => (
            <li key={v.id} className="flex items-center justify-between rounded-lg border border-white/10 p-2 text-xs">
              <span className="truncate text-zinc-300">{v.url.split("/").pop()}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-red-300"
                onClick={async () => {
                  const r = await deleteMotorcycleVideo(v.id);
                  if (r.error) toast.error(r.error);
                  else {
                    toast.success("Removed.");
                    refresh();
                  }
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
