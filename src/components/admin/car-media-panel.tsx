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
import type { CarImage, CarVideo } from "@prisma/client";
import { GripVertical, Star } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ReactNode, useMemo, useTransition } from "react";
import { toast } from "sonner";

import {
  addCarImage,
  addCarVideo,
  deleteCarImage,
  deleteCarVideo,
  reorderCarImages,
  reorderCarVideos,
  setCarCoverFromImage,
  setFeaturedCarVideo,
} from "@/actions/car-media";
import { LazyVideo } from "@/components/media/lazy-video";
import { Button } from "@/components/ui/button";
import { optimizeCloudinaryUrl } from "@/lib/cloudinary-delivery";
import { uploadFileToCloudinary } from "@/lib/cloudinary-upload-client";

type Props = {
  carId: string;
  images: Pick<CarImage, "id" | "url" | "sortOrder" | "isCover" | "publicId">[];
  videos: Pick<CarVideo, "id" | "url" | "sortOrder" | "thumbnailUrl" | "publicId" | "isFeatured">[];
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

export function CarMediaPanel({ carId, images, videos }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const sortedImages = useMemo(() => [...images].sort((a, b) => a.sortOrder - b.sortOrder), [images]);
  const sortedVideos = useMemo(() => [...videos].sort((a, b) => a.sortOrder - b.sortOrder), [videos]);

  const imageIds = useMemo(() => sortedImages.map((i) => i.id), [sortedImages]);
  const videoIds = useMemo(() => sortedVideos.map((v) => v.id), [sortedVideos]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function onPickImages(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        const json = await uploadFileToCloudinary(file, `sda/cars/${carId}/images`, "image");
        const r = await addCarImage(carId, { url: json.secure_url, publicId: json.public_id });
        if (r?.error) toast.error(r.error);
        else toast.success("Image added");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      }
    }
    refresh();
  }

  async function onPickVideos(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        const json = await uploadFileToCloudinary(file, `sda/cars/${carId}/videos`, "video");
        const r = await addCarVideo(carId, { url: json.secure_url, publicId: json.public_id });
        if (r?.error) toast.error(r.error);
        else toast.success("Video added");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      }
    }
    refresh();
  }

  async function onImagesDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = imageIds.indexOf(active.id as string);
    const newIndex = imageIds.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(sortedImages, oldIndex, newIndex);
    const r = await reorderCarImages(
      carId,
      next.map((x) => x.id)
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
    const r = await reorderCarVideos(
      carId,
      next.map((x) => x.id)
    );
    if (r?.error) toast.error(r.error);
    else toast.success("Video order saved");
    refresh();
  }

  return (
    <div className="max-w-3xl space-y-10">
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-lg font-semibold text-white">Gallery images</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Upload to Cloudinary, drag by the handle to reorder, set cover for cards and hero.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Original files are kept at upload quality (including 4K+). Optimized variants are only used for faster page delivery.
        </p>
        <div className="mt-4">
          <input
            type="file"
            accept="image/*,application/pdf,.pdf"
            multiple
            className="text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-white"
            onChange={(e) => {
              void onPickImages(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void onImagesDragEnd(e)}>
          <SortableContext items={imageIds} strategy={verticalListSortingStrategy}>
            <ul className="mt-6 space-y-4">
              {sortedImages.map((im) => (
                <SortableGalleryRow key={im.id} id={im.id}>
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
                          src={optimizeCloudinaryUrl(im.url, "tableThumb")}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="160px"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="truncate text-xs text-zinc-500">{im.url}</p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              const r = await setCarCoverFromImage(carId, im.id);
                              if (r?.error) toast.error(r.error);
                              else toast.success("Cover updated");
                              refresh();
                            }}
                          >
                            {im.isCover ? "Cover ✓" : "Set cover"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={async () => {
                              if (!confirm("Delete this image?")) return;
                              const r = await deleteCarImage(im.id);
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

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-lg font-semibold text-white">Videos</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Upload walkthrough clips; drag to reorder. Star one as the hero clip (shown first on the public page).
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Videos are uploaded as provided; playback optimization happens at viewing time without replacing the original asset.
        </p>
        <div className="mt-4">
          <input
            type="file"
            accept="video/mp4,video/webm,video/*,.mp4,.webm"
            multiple
            className="text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-white"
            onChange={(e) => {
              void onPickVideos(e.target.files);
              e.target.value = "";
            }}
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
                          poster={v.thumbnailUrl ?? undefined}
                          featured={v.isFeatured}
                          className="absolute inset-0"
                          videoClassName="h-full w-full object-cover"
                          title="Vehicle video preview"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-xs text-zinc-500">{v.url}</p>
                          {v.isFeatured ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200">
                              <Star className="size-3" aria-hidden />
                              Hero
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
                              const r = await setFeaturedCarVideo(carId, v.id);
                              if (r?.error) toast.error(r.error);
                              else toast.success("Hero video updated");
                              refresh();
                            }}
                          >
                            {v.isFeatured ? "Hero video" : "Set as hero"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={async () => {
                              if (!confirm("Delete this video?")) return;
                              const r = await deleteCarVideo(v.id);
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
