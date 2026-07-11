"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";

import { VehicleCoverImage } from "@/components/cars/vehicle-cover-image";
import { MediaFullscreenViewer } from "@/components/media/media-fullscreen-viewer";
import { Button } from "@/components/ui/button";
import type { PartGalleryImage } from "@/lib/part-gallery-images";
import { optimizeCloudinaryUrl } from "@/lib/cloudinary-delivery";
import { cn } from "@/lib/utils";

export type { PartGalleryImage };

type Props = {
  images: PartGalleryImage[];
  productTitle: string;
  className?: string;
};

function PartImageGalleryInner({ images, productTitle, className }: Props) {
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
    if (count <= 1) return;
    const links: HTMLLinkElement[] = [];
    const preset = "galleryStage" as const;
    const pushPreload = (url: string) => {
      const href = optimizeCloudinaryUrl(url, preset);
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = href;
      document.head.appendChild(link);
      links.push(link);
    };
    const nextIdx = (safe + 1) % count;
    const prevIdx = (safe - 1 + count) % count;
    const nu = images[nextIdx]?.url;
    const pu = images[prevIdx]?.url;
    if (nu) pushPreload(nu);
    if (pu && prevIdx !== nextIdx) pushPreload(pu);
    return () => {
      for (const l of links) l.remove();
    };
  }, [count, images, safe]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, go]);

  if (!current || count === 0) {
    return (
      <div
        className={cn(
          "flex aspect-[4/3] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]",
          className,
        )}
      >
        <VehicleCoverImage
          src="/brand/logo-emblem.png"
          alt=""
          width={120}
          height={120}
          className="h-auto w-auto opacity-40"
          sizes="120px"
          deliveryPreset="none"
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80">
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          className="relative block h-full w-full cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={
            count > 1
              ? `View photo ${safe + 1} of ${count} full screen`
              : `View ${productTitle} full screen`
          }
        >
          <VehicleCoverImage
            key={current.id}
            src={current.url}
            alt={count > 1 ? `${productTitle} — photo ${safe + 1} of ${count}` : productTitle}
            fill
            loading="eager"
            imagePlaceholder
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
            deliveryPreset="partDetailHero"
          />
        </button>

        {count > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              className="absolute top-1/2 left-2 z-10 -translate-y-1/2 rounded-lg border border-white/20 bg-black/50 p-1.5 text-white opacity-0 transition hover:bg-black/70 group-hover:opacity-100"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              className="absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-lg border border-white/20 bg-black/50 p-1.5 text-white opacity-0 transition hover:bg-black/70 group-hover:opacity-100"
            >
              <ChevronRight className="size-5" />
            </button>
            <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/55 px-2 py-0.5 text-xs font-mono text-white/90">
              {safe + 1} / {count}
            </span>
          </>
        ) : null}

        <Button
          type="button"
          size="icon-sm"
          variant="secondary"
          className="absolute right-2 top-2 z-10 bg-black/55 text-white hover:bg-black/70"
          onClick={(e) => {
            e.stopPropagation();
            setFullscreen(true);
          }}
          aria-label="Open full screen gallery"
        >
          <Maximize2 className="size-4" />
        </Button>
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
                onDoubleClick={() => {
                  setIndex(i);
                  setFullscreen(true);
                }}
                className={cn(
                  "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition",
                  selected ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/40" : "border-white/10 opacity-80 hover:opacity-100",
                )}
              >
                <VehicleCoverImage
                  src={img.url}
                  alt=""
                  fill
                  loading="lazy"
                  className="object-cover"
                  sizes="64px"
                  deliveryPreset="galleryStrip"
                />
              </button>
            );
          })}
        </div>
      ) : null}

      <MediaFullscreenViewer
        open={fullscreen}
        onClose={() => setFullscreen(false)}
        title={productTitle}
        subtitle={count > 1 ? `${safe + 1} / ${count}` : undefined}
        ariaLabel="Full screen product photos"
        footer={
          count > 1 ? (
            <div className="flex max-h-28 shrink-0 justify-center gap-2 overflow-x-auto border-t border-white/10 bg-black/80 px-2 py-[max(0.75rem,env(safe-area-inset-bottom))]">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={cn(
                    "relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2",
                    i === safe ? "border-white" : "border-transparent opacity-70 hover:opacity-100",
                  )}
                  aria-label={`Go to image ${i + 1}`}
                >
                  <VehicleCoverImage
                    src={img.url}
                    alt=""
                    fill
                    loading="lazy"
                    className="object-cover"
                    sizes="64px"
                    deliveryPreset="galleryStrip"
                  />
                </button>
              ))}
            </div>
          ) : undefined
        }
      >
        {count > 1 ? (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute left-2 top-1/2 z-10 h-11 w-11 -translate-y-1/2 rounded-full bg-white/15 text-white hover:bg-white/25 sm:left-4"
            onClick={() => go(-1)}
            aria-label="Previous image"
          >
            <ChevronLeft className="size-7" />
          </Button>
        ) : null}
        <div className="relative mx-auto h-[min(78dvh,calc(100dvh-12rem))] w-full max-w-[min(100vw,1200px)]">
          <VehicleCoverImage
            key={`fs-${current.id}`}
            src={current.url}
            alt={`${productTitle} — photo ${safe + 1} of ${count}`}
            fill
            loading="eager"
            className="object-contain"
            sizes="100vw"
            priority
            deliveryPreset="galleryPremium"
          />
        </div>
        {count > 1 ? (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute right-2 top-1/2 z-10 h-11 w-11 -translate-y-1/2 rounded-full bg-white/15 text-white hover:bg-white/25 sm:right-4"
            onClick={() => go(1)}
            aria-label="Next image"
          >
            <ChevronRight className="size-7" />
          </Button>
        ) : null}
      </MediaFullscreenViewer>
    </div>
  );
}

export const PartImageGallery = memo(PartImageGalleryInner);
