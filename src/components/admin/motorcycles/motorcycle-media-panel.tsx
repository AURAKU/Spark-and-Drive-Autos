"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MotorcycleImage, MotorcycleVideo } from "@prisma/client";
import { GripVertical, Star, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ReactNode, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  addMotorcycleImage,
  addMotorcycleVideo,
  deleteMotorcycleImage,
  deleteMotorcycleVideo,
  reorderMotorcycleImages,
  reorderMotorcycleVideos,
  setFeaturedMotorcycleVideo,
  setMotorcycleCoverFromImage,
} from "@/actions/motorcycle-media";
import { InventoryMediaSourcePicker } from "@/components/admin/inventory-media-source-picker";
import { LazyVideo } from "@/components/media/lazy-video";
import { Button } from "@/components/ui/button";
import { resolveCarVideoPosterUrl } from "@/lib/car-video-poster";
import { optimizeCloudinaryUrl } from "@/lib/cloudinary-delivery";
import { inventoryVideoMaxSizeLabel, uploadFileToCloudinary } from "@/lib/cloudinary-upload-client";

export function motorcycleMediaFolder(motorcycleId: string, kind: "images" | "videos") {
  return `sda/admin/motorcycles/${motorcycleId}/${kind}`;
}

type Props = {
  motorcycleId: string;
  images: Pick<MotorcycleImage, "id" | "url" | "sortOrder" | "isCover" | "publicId">[];
  videos: Pick<
    MotorcycleVideo,
    "id" | "url" | "sortOrder" | "thumbnailUrl" | "publicId" | "mimeType" | "isFeatured"
  >[];
};

function SortableGalleryRow({
  id,
  children,
}: {
  id: string;
  children: (dragHandleProps: Record<string, unknown>) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 1 : 0,
  };
  const handleProps = { ...attributes, ...listeners };
  return (
    <li ref={setNodeRef} style={style} className="rounded-xl border border-white/10 bg-black/20 p-3">
      {children(handleProps)}
    </li>
  );
}

export function MotorcycleMediaPanel({ motorcycleId, images, videos }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingVideos, setUploadingVideos] = useState(false);

  const sortedImages = useMemo(() => [...images].sort((a, b) => a.sortOrder - b.sortOrder), [images]);
  const sortedVideos = useMemo(() => [...videos].sort((a, b) => a.sortOrder - b.sortOrder), [videos]);
  const imageIds = useMemo(() => sortedImages.map((i) => i.id), [sortedImages]);
  const videoIds = useMemo(() => sortedVideos.map((v) => v.id), [sortedVideos]);
  const firstStillUrl = sortedImages[0]?.url ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
      toast.success(files.length === 1 ? "Video uploaded." : `${files.length} videos uploaded.`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploadingVideos(false);
    }
  }

  async function onImagesDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = imageIds.indexOf(active.id as string);
    const newIndex = imageIds.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(sortedImages, oldIndex, newIndex);
    const r = await reorderMotorcycleImages(
      motorcycleId,
      next.map((x) => x.id),
    );
    if (r?.error) toast.error(r.error);
    else toast.success("Gallery order saved");
    refresh();
  }

  async function onVideosDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = videoIds.indexOf(active.id as string);
    const newIndex = videoIds.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(sortedVideos, oldIndex, newIndex);
    const r = await reorderMotorcycleVideos(
      motorcycleId,
      next.map((x) => x.id),
    );
    if (r?.error) toast.error(r.error);
    else toast.success("Video order saved");
    refresh();
  }

  return (
    <div className="max-w-3xl space-y-10">
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">Photos</h3>
            <p className="mt-0.5 text-[10px] text-zinc-500">
              Multiple uploads · drag to reorder · set cover for cards and hero.
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void onImagesDragEnd(e)}>
          <SortableContext items={imageIds} strategy={verticalListSortingStrategy}>
            <ul className="mt-6 space-y-4">
              {sortedImages.map((img) => (
                <SortableGalleryRow key={img.id} id={img.id}>
                  {(dragProps) => (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 active:cursor-grabbing"
                        aria-label="Drag to reorder image"
                        {...dragProps}
                      >
                        <GripVertical className="size-5" />
                      </button>
                      <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
                        <Image
                          src={optimizeCloudinaryUrl(img.url, "tableThumb")}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="160px"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="truncate text-xs text-zinc-500">{img.url}</p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              const r = await setMotorcycleCoverFromImage(motorcycleId, img.id);
                              if (r?.error) toast.error(r.error);
                              else toast.success("Cover updated");
                              refresh();
                            }}
                          >
                            {img.isCover ? "Cover ✓" : "Set cover"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={async () => {
                              if (!confirm("Remove this photo?")) return;
                              const r = await deleteMotorcycleImage(img.id);
                              if (r?.error) toast.error(r.error);
                              else toast.success("Removed");
                              refresh();
                            }}
                          >
                            <Trash2 className="mr-1 size-3.5" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </SortableGalleryRow>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">Videos</h3>
            <p className="mt-0.5 text-[10px] text-zinc-500">
              Multiple walkthrough clips · drag to reorder · star one as featured. Max{" "}
              {inventoryVideoMaxSizeLabel()} per file.
            </p>
          </div>
          <InventoryMediaSourcePicker
            kind="video"
            multiple
            disabled={uploadingVideos}
            uploadLabel={uploadingVideos ? "Uploading…" : "Add videos"}
            onFilesReady={onVideoFilesReady}
          />
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void onVideosDragEnd(e)}>
          <SortableContext items={videoIds} strategy={verticalListSortingStrategy}>
            <ul className="mt-6 space-y-4">
              {sortedVideos.map((v) => (
                <SortableGalleryRow key={v.id} id={v.id}>
                  {(dragProps) => (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 active:cursor-grabbing"
                        aria-label="Drag to reorder video"
                        {...dragProps}
                      >
                        <GripVertical className="size-5" />
                      </button>
                      <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-lg border border-white/10 bg-black">
                        <LazyVideo
                          src={v.url}
                          poster={resolveCarVideoPosterUrl(v, firstStillUrl)}
                          featured={v.isFeatured}
                          className="absolute inset-0"
                          videoClassName="h-full w-full object-cover"
                          title="Motorcycle video preview"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-xs text-zinc-500">{v.url}</p>
                          {v.isFeatured ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200">
                              <Star className="size-3" aria-hidden />
                              Featured
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={v.isFeatured}
                            onClick={async () => {
                              const r = await setFeaturedMotorcycleVideo(motorcycleId, v.id);
                              if (r?.error) toast.error(r.error);
                              else toast.success("Featured video updated");
                              refresh();
                            }}
                          >
                            {v.isFeatured ? "Featured video" : "Set as featured"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={async () => {
                              if (!confirm("Remove this video?")) return;
                              const r = await deleteMotorcycleVideo(v.id);
                              if (r?.error) toast.error(r.error);
                              else toast.success("Removed");
                              refresh();
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </SortableGalleryRow>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </section>
    </div>
  );
}
