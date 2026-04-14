"use client";

import type { PartImage } from "@prisma/client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { addPartGalleryImage, deletePartGalleryImage } from "@/actions/parts";
import { uploadFileToCloudinary } from "@/lib/cloudinary-upload-client";
import { Button } from "@/components/ui/button";

type Props = {
  partId: string;
  images: Pick<PartImage, "id" | "url" | "publicId" | "sortOrder">[];
};

export function PartGalleryPanel({ partId, images }: Props) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function uploadExtra(file: File) {
    setUploading(true);
    try {
      const json = await uploadFileToCloudinary(file, "spark-drive/parts/gallery", "image");
      const fd = new FormData();
      fd.set("partId", partId);
      fd.set("url", json.secure_url);
      fd.set("publicId", json.public_id);
      const result = await addPartGalleryImage(null, fd);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Gallery image added");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
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
        <input
          type="file"
          accept="image/*"
          className="mt-2 text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-white"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadExtra(f);
            e.target.value = "";
          }}
        />
        {uploading ? <p className="mt-1 text-xs text-zinc-500">Uploading…</p> : null}
      </div>
      {images.length === 0 ? (
        <p className="text-sm text-zinc-500">No extra images yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {images.map((img) => (
            <li key={img.id} className="flex gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-white/10">
                <Image src={img.url} alt="" fill className="object-cover" sizes="112px" unoptimized />
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
