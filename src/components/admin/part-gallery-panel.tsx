"use client";

import type { PartImage } from "@prisma/client";
import { Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { addPartGalleryImage, deletePartGalleryImage } from "@/actions/parts";
import { VehicleCoverImage } from "@/components/cars/vehicle-cover-image";
import { uploadFileToCloudinary } from "@/lib/cloudinary-upload-client";
import { Button } from "@/components/ui/button";

type Props = {
  partId: string;
  images: Pick<PartImage, "id" | "url" | "publicId" | "sortOrder">[];
};

type Queued = { key: string; file: File; preview: string };

export function PartGalleryPanel({ partId, images }: Props) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [queue, setQueue] = useState<Queued[]>([]);

  function enqueue(files: FileList | null) {
    if (!files?.length) return;
    const next = Array.from(files).map((file) => ({
      key: `${file.name}-${file.size}-${crypto.randomUUID()}`,
      file,
      preview: URL.createObjectURL(file),
    }));
    setQueue((q) => [...q, ...next]);
  }

  function removeQueued(key: string) {
    setQueue((q) => {
      const hit = q.find((x) => x.key === key);
      if (hit) URL.revokeObjectURL(hit.preview);
      return q.filter((x) => x.key !== key);
    });
  }

  async function flushQueue() {
    if (queue.length === 0) return;
    setUploading(true);
    try {
      for (const item of queue) {
        try {
          const json = await uploadFileToCloudinary(item.file, "spark-drive/parts/gallery", "image");
          const fd = new FormData();
          fd.set("partId", partId);
          fd.set("url", json.secure_url);
          fd.set("publicId", json.public_id);
          const result = await addPartGalleryImage(null, fd);
          if (result && "error" in result && result.error) {
            toast.error(result.error);
          } else {
            toast.success("Gallery image added");
          }
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Upload failed");
        } finally {
          URL.revokeObjectURL(item.preview);
        }
      }
      setQueue([]);
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(imageId: string) {
    setDeletingId(imageId);
    try {
      const fd = new FormData();
      fd.set("partId", partId);
      fd.set("imageId", imageId);
      await deletePartGalleryImage(fd);
      toast.success("Image removed");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Gallery images</p>
        <p className="mt-1 text-xs text-zinc-500">Additional photos shown on the public product page (cover is separate).</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept="image/*,application/pdf,.pdf"
            multiple
            className="text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-white"
            disabled={uploading}
            onChange={(e) => {
              enqueue(e.target.files);
              e.target.value = "";
            }}
          />
          {queue.length > 0 ? (
            <Button
              type="button"
              size="sm"
              className="gap-1.5 bg-[var(--brand)] text-black hover:opacity-90"
              disabled={uploading}
              onClick={() => void flushQueue()}
            >
              <Upload className="size-4" aria-hidden />
              Upload {queue.length} {queue.length === 1 ? "image" : "images"}
            </Button>
          ) : null}
        </div>
        {uploading ? <p className="mt-1 text-xs text-zinc-500">Uploading…</p> : null}
        {queue.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-3">
            {queue.map((q) => (
              <li key={q.key} className="relative">
                <div className="relative h-20 w-28 overflow-hidden rounded-lg border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={q.preview} alt="" className="h-full w-full object-cover" />
                </div>
                <button
                  type="button"
                  className="absolute -right-1 -top-1 rounded-full border border-white/20 bg-black/80 p-1 text-zinc-200 hover:bg-red-500/80"
                  aria-label="Remove from queue"
                  onClick={() => removeQueued(q.key)}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {images.length === 0 ? (
        <p className="text-sm text-zinc-500">No extra images yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {images.map((img) => (
            <li key={img.id} className="flex gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-white/10">
                <VehicleCoverImage
                  src={img.url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="112px"
                  deliveryPreset="tableThumb"
                />
              </div>
              <div className="flex flex-1 flex-col justify-between">
                <p className="truncate text-xs text-zinc-500">{img.url.slice(0, 48)}…</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deletingId === img.id}
                  className="mt-2 w-fit border-red-500/40 text-red-300 hover:bg-red-500/10"
                  onClick={() => void onDelete(img.id)}
                >
                  {deletingId === img.id ? "Removing…" : "Remove"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
