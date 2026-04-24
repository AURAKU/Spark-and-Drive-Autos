"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { CarGalleryImage } from "@/lib/car-gallery";
import { cn } from "@/lib/utils";

type Props = {
  images: CarGalleryImage[];
  children?: ReactNode;
};

export function CarGallery({ images, children }: Props) {
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const count = images.length;
  const safeActive = count > 0 ? Math.min(active, count - 1) : 0;
  const current = count > 0 ? images[safeActive] : null;

  const go = useCallback(
    (delta: number) => {
      if (count <= 1) return;
      setActive((i) => (i + delta + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, go]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lightboxOpen]);

  if (count === 0) {
    return (
      <div className="space-y-4">
        <div className="relative aspect-[16/10] overflow-hidden rounded-3xl border border-border bg-muted dark:border-white/10 dark:bg-zinc-900">
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No image</div>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-[16/10] overflow-hidden rounded-3xl border border-border bg-muted dark:border-white/10 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="relative block h-full w-full cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={`View image ${safeActive + 1} of ${count} full screen`}
        >
          <Image
            src={current!.url}
            alt={current!.alt}
            fill
            priority
            className="object-cover"
            sizes="(max-width:1024px) 100vw, 58vw"
          />
        </button>

        {children}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-3 pt-10">
          <p className="pointer-events-none text-center text-xs font-medium text-white/90">
            {safeActive + 1} / {count}
          </p>
        </div>

        <Button
          type="button"
          size="icon-sm"
          variant="secondary"
          className="absolute right-3 top-3 z-20 bg-black/55 text-white hover:bg-black/70"
          onClick={(e) => {
            e.stopPropagation();
            setLightboxOpen(true);
          }}
          aria-label="Open full screen gallery"
        >
          <Maximize2 className="size-4" />
        </Button>

        {count > 1 ? (
          <>
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              className="absolute left-2 top-1/2 z-20 -translate-y-1/2 bg-black/55 text-white hover:bg-black/70"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              aria-label="Previous image"
            >
              <ChevronLeft className="size-5" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              className="absolute right-2 top-1/2 z-20 -translate-y-1/2 bg-black/55 text-white hover:bg-black/70"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              aria-label="Next image"
            >
              <ChevronRight className="size-5" />
            </Button>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {images.map((im, i) => (
          <button
            key={im.id}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "relative aspect-[4/3] overflow-hidden rounded-xl border-2 bg-muted transition dark:bg-zinc-900",
              i === safeActive
                ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/40"
                : "border-border opacity-90 hover:opacity-100 dark:border-white/10",
            )}
            aria-label={`Show image ${i + 1} of ${count}`}
            aria-current={i === safeActive ? "true" : undefined}
          >
            <Image src={im.url} alt="" fill className="object-cover" sizes="120px" />
          </button>
        ))}
      </div>

      {lightboxOpen ? (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black"
          role="dialog"
          aria-modal="true"
          aria-label="Full screen vehicle photos"
        >
          <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between gap-2 bg-gradient-to-b from-black/80 to-transparent px-3 py-3 sm:px-4">
            <p className="truncate pl-1 text-sm font-medium text-white">
              {safeActive + 1} / {count}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 text-white hover:bg-white/10 hover:text-white"
              onClick={() => setLightboxOpen(false)}
            >
              Close
            </Button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-16 pt-14 sm:px-6">
            <Image
              src={current!.url}
              alt={current!.alt}
              width={1920}
              height={1080}
              className="max-h-[calc(100dvh-8rem)] w-auto max-w-full object-contain"
              sizes="100vw"
              priority
            />

            {count > 1 ? (
              <>
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
              </>
            ) : null}
          </div>

          {count > 1 ? (
            <div className="absolute bottom-0 left-0 right-0 z-10 border-t border-white/10 bg-black/80 px-2 py-2">
              <div className="mx-auto flex max-w-4xl gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-thin">
                {images.map((im, i) => (
                  <button
                    key={im.id}
                    type="button"
                    onClick={() => setActive(i)}
                    className={cn(
                      "relative h-14 w-20 shrink-0 overflow-hidden rounded-md border-2 transition sm:h-16 sm:w-24",
                      i === safeActive ? "border-[var(--brand)]" : "border-transparent opacity-70 hover:opacity-100",
                    )}
                    aria-label={`Go to image ${i + 1}`}
                  >
                    <Image src={im.url} alt="" fill className="object-cover" sizes="96px" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
