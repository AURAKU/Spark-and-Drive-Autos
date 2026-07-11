"use client";

import type { MotorcycleImage, MotorcycleVideo } from "@prisma/client";
import { Trash2 } from "lucide-react";
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
import { InventoryMediaSourcePicker } from "@/components/admin/inventory-media-source-picker";
import { LazyVideo } from "@/components/media/lazy-video";
import { Button } from "@/components/ui/button";
import { optimizeCloudinaryUrl } from "@/lib/cloudinary-delivery";
import { inventoryVideoMaxSizeLabel, uploadFileToCloudinary } from "@/lib/cloudinary-upload-client";

export function motorcycleMediaFolder(motorcycleId: string, kind: "images" | "videos") {
  return `sda/admin/motorcycles/${motorcycleId}/${kind}`;
}

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

  async function onImageFilesReady(files: File[]) {
    if (!files.length) return;
    setUploadingImages(true);
    try {
      for (const file of files) {
        const uploaded = await uploadFileToCloudinary(
          file,
          motorcycleMediaFolder(motorcycleId, "images"),
          "image",
        );
        const result = await addMotorcycleImage(motorcycleId, {
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
        });
        if (result.error) throw new Error(result.error);
      }
      toast.success(files.length === 1 ? "Photo uploaded." : `${files.length} photos uploaded.`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploadingImages(false);
    }
  }

  async function onVideoFilesReady(files: File[]) {
    if (!files.length) return;
    setUploadingVideos(true);
    try {
      for (const file of files) {
        const uploaded = await uploadFileToCloudinary(
          file,
          motorcycleMediaFolder(motorcycleId, "videos"),
          "video",
        );
        const result = await addMotorcycleVideo(motorcycleId, {
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
          mimeType: file.type || null,
        });
        if (result.error) throw new Error(result.error);
      }
      toast.success("Video uploaded.");
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">Photos</h3>
            <p className="mt-0.5 text-[10px] text-zinc-500">
              Import from device or take a photo, then crop freely before upload.
            </p>
          </div>
          <InventoryMediaSourcePicker
            kind="image"
            multiple
            disabled={uploadingImages}
            uploadLabel={uploadingImages ? "Uploading…" : "Add photos"}
            onFilesReady={onImageFilesReady}
          />
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
                {img.isCover ? (
                  <span className="absolute left-1 top-1 rounded bg-[var(--brand)]/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-black">
                    Cover
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className="absolute right-1 top-1 rounded bg-black/70 p-1 text-zinc-200 hover:text-red-300"
                aria-label="Remove photo"
                onClick={async () => {
                  if (!confirm("Remove this photo?")) return;
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">Videos</h3>
            <p className="mt-0.5 text-[10px] text-zinc-500">
              Import from device or record a clip. Max {inventoryVideoMaxSizeLabel()} per file.
            </p>
          </div>
          <InventoryMediaSourcePicker
            kind="video"
            disabled={uploadingVideos}
            uploadLabel={uploadingVideos ? "Uploading…" : "Add video"}
            onFilesReady={onVideoFilesReady}
          />
        </div>
        <ul className="mt-4 space-y-3">
          {videos.map((v) => (
            <li key={v.id} className="overflow-hidden rounded-lg border border-white/10">
              <div className="relative aspect-video bg-black">
                <LazyVideo
                  src={v.url}
                  poster={v.thumbnailUrl ?? undefined}
                  className="absolute inset-0"
                  videoClassName="h-full w-full object-contain"
                  title="Motorcycle video"
                />
              </div>
              <div className="flex items-center justify-between gap-2 p-2 text-xs">
                <span className="truncate text-zinc-400">{v.url.split("/").pop()}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 shrink-0 text-red-300"
                  onClick={async () => {
                    if (!confirm("Remove this video?")) return;
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
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
