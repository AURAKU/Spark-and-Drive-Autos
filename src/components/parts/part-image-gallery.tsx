"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PartGalleryImage = { id: string; url: string };

type Props = {
  images: PartGalleryImage[];
  productTitle: string;
  className?: string;
};

/**
 * Deduplicated ordered list: cover first (if any), then additional uploads.
 */
export function buildPartGalleryImageList(
  cover: string | null | undefined,
  partImages: PartGalleryImage[],
): PartGalleryImage[] {
  const out: PartGalleryImage[] = [];
  const seen = new Set<string>();
  const push = (id: string, url: string) => {
    const u = url.trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push({ id, url: u });
  };
  if (cover) push("cover", cover);
  for (const img of partImages) push(img.id, img.url);
  return out;
}

export function PartImageGallery({ images, productTitle, className }: Props) {
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const count = images.length;
  const safe = count > 0 ? Math.min(index, count - 1) : 0;
  const current = images[safe] ?? null;

  const go = useCallback(
    (delta: number) => {
      if (count <= 0) return;
      setIndex((i) => (i + delta + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (count > 0 && index >= count) setIndex(0);
  }, [count, index]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen, go]);

  if (!current || count === 0) {
    return (
      <div
        className={cn(
          "flex aspect-[4/3] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]",
          className,
        )}
      >
        <Image src="/brand/logo-emblem.png" alt="" width={120} height={120} className="opacity-40" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-black/40">
        <Image
          src={current.url}
          alt={count > 1 ? `${productTitle} — photo ${safe + 1} of ${count}` : productTitle}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 50vw"
          unoptimized
        />
        {count > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => go(-1)}
              className="absolute top-1/2 left-2 -translate-y-1/2 rounded-lg border border-white/20 bg-black/50 p-1.5 text-white opacity-0 transition hover:bg-black/70 group-hover:opacity-100"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={() => go(1)}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg border border-white/20 bg-black/50 p-1.5 text-white opacity-0 transition hover:bg-black/70 group-hover:opacity-100"
            >
              <ChevronRight className="size-5" />
            </button>
            <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/55 px-2 py-0.5 text-xs font-mono text-white/90">
              {safe + 1} / {count}
            </span>
          </>
        ) : null}
        <div className="absolute bottom-2 left-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 border border-white/20 bg-black/50 text-white hover:bg-black/70"
            onClick={() => setFullscreen(true)}
            aria-label="View full screen"
          >
            <Maximize2 className="size-3.5" />
            <span className="ml-1.5">Full screen</span>
          </Button>
        </div>
      </div>

      {count > 1 ? (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Product photos">
          {images.map((img, i) => {
            const selected = i === safe;
            return (
              <button
                key={img.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setIndex(i)}
                className={cn(
                  "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition",
                  selected ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/40" : "border-white/10 opacity-80 hover:opacity-100",
                )}
              >
                <Image src={img.url} alt="" fill className="object-cover" sizes="64px" unoptimized />
              </button>
            );
          })}
        </div>
      ) : null}

      {fullscreen ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label="Full screen gallery"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2 text-white">
            <p className="truncate text-sm font-medium">{productTitle}</p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="shrink-0 text-white hover:bg-white/10"
              onClick={() => setFullscreen(false)}
              aria-label="Close"
            >
              <X className="size-5" />
            </Button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
            {count > 1 ? (
              <button
                type="button"
                aria-label="Previous image"
                onClick={() => go(-1)}
                className="absolute top-1/2 left-2 z-10 -translate-y-1/2 rounded-lg border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20"
              >
                <ChevronLeft className="size-7" />
              </button>
            ) : null}
            <div className="relative h-full w-full max-h-[80vh]">
              <Image
                src={current.url}
                alt={`${productTitle} — photo ${safe + 1} of ${count}`}
                fill
                className="object-contain"
                sizes="100vw"
                unoptimized
                priority
              />
            </div>
            {count > 1 ? (
              <button
                type="button"
                aria-label="Next image"
                onClick={() => go(1)}
                className="absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-lg border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20"
              >
                <ChevronRight className="size-7" />
              </button>
            ) : null}
          </div>
          {count > 1 ? (
            <div className="flex max-h-28 shrink-0 justify-center gap-2 overflow-x-auto border-t border-white/10 px-2 py-3">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={cn(
                    "relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2",
                    i === safe ? "border-white" : "border-transparent opacity-70 hover:opacity-100",
                  )}
                >
                  <Image src={img.url} alt="" fill className="object-cover" sizes="64px" unoptimized />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
