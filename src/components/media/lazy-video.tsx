"use client";

import { CirclePlay, Maximize2 } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";

import { VehicleCoverImage } from "@/components/cars/vehicle-cover-image";
import { MediaFullscreenViewer } from "@/components/media/media-fullscreen-viewer";
import { Button } from "@/components/ui/button";
import { optimizeCloudinaryUrl, type CloudinaryDeliveryPreset } from "@/lib/cloudinary-delivery";
import { VEHICLE_IMAGE_PLACEHOLDER_SRC } from "@/lib/vehicle-image-fallback";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  poster?: string | null;
  className?: string;
  /** Classes on the `<video>` element (default `aspect-video w-full`). */
  videoClassName?: string;
  /** Featured clip uses premium delivery transforms when no `deliveryPreset` is set. */
  featured?: boolean;
  /** When false with `clickToLoad`, wait for intersection before showing the play affordance (unused if clickToLoad). */
  eagerMount?: boolean;
  /**
   * When true: show poster + play control only; `<video>` mounts after user taps (no preload until then).
   * Recommended for detail pages and anywhere bandwidth matters.
   */
  clickToLoad?: boolean;
  /**
   * When true (default with `clickToLoad`): first tap opens a fullscreen viewer and loads the clip there.
   * Set false to keep playback inline in the grid/card.
   */
  openInFullscreen?: boolean;
  /** Optional Cloudinary delivery transform for playback stream. */
  deliveryPreset?: CloudinaryDeliveryPreset;
  /** Optional label for the clip (accessibility). */
  title?: string;
};

function VideoElement({
  sourceUrl,
  posterUrl,
  videoClassName,
  title,
  videoRef,
  autoPlay,
}: {
  sourceUrl: string;
  posterUrl?: string;
  videoClassName: string;
  title?: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  autoPlay?: boolean;
}) {
  useEffect(() => {
    if (!autoPlay) return;
    void videoRef.current?.play().catch(() => {
      /* user may need to interact again on strict browsers */
    });
  }, [autoPlay, sourceUrl, videoRef]);

  return (
    <video
      ref={videoRef}
      controls
      className={videoClassName}
      poster={posterUrl}
      preload="none"
      playsInline
      title={title}
    >
      <source src={sourceUrl} />
    </video>
  );
}

/**
 * Defers loading `<video>` until near viewport, or until user taps when `clickToLoad` is set.
 * Supports expanding to a fullscreen viewer for immersive playback.
 */
export function LazyVideo({
  src,
  poster,
  className,
  videoClassName = "aspect-video w-full",
  featured = false,
  eagerMount = false,
  clickToLoad = false,
  openInFullscreen,
  deliveryPreset,
  title,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inlineVideoRef = useRef<HTMLVideoElement>(null);
  const fullscreenVideoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(() => Boolean(eagerMount) && !clickToLoad);
  const [unlocked, setUnlocked] = useState(() => !clickToLoad);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const expandOnOpen = openInFullscreen ?? clickToLoad;

  useEffect(() => {
    if (clickToLoad || active) return;
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setActive(true);
      },
      { rootMargin: "200px", threshold: 0.01 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [active, clickToLoad]);

  useEffect(() => {
    if (!clickToLoad || !unlocked || expandOnOpen) return;
    void inlineVideoRef.current?.play().catch(() => {
      /* user may need to interact again on strict browsers */
    });
  }, [clickToLoad, unlocked, expandOnOpen]);

  const sourceUrl = optimizeCloudinaryUrl(
    src,
    deliveryPreset ?? (featured ? "videoPremium" : "videoPreview"),
  );

  const posterUrl = poster?.trim()
    ? optimizeCloudinaryUrl(poster.trim(), "galleryStrip")
    : undefined;

  const thumbSrc = posterUrl ?? VEHICLE_IMAGE_PLACEHOLDER_SRC;

  const openFullscreen = () => {
    setUnlocked(true);
    setFullscreenOpen(true);
  };

  const fullscreenVideoClassName =
    "max-h-[calc(100dvh-8rem)] w-full max-w-[min(100vw,1400px)] object-contain";

  if (clickToLoad && !unlocked) {
    return (
      <div ref={wrapRef} className={className}>
        <button
          type="button"
          className="group relative block w-full overflow-hidden rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          aria-label={
            title
              ? expandOnOpen
                ? `Open full screen video: ${title}`
                : `Load and play video: ${title}`
              : expandOnOpen
                ? "Open full screen video"
                : "Play video"
          }
          onClick={() => {
            setUnlocked(true);
            if (expandOnOpen) setFullscreenOpen(true);
          }}
        >
          <div className={cn("relative bg-muted/80 dark:bg-black/50", videoClassName)}>
            <VehicleCoverImage
              src={thumbSrc}
              alt=""
              fill
              loading="lazy"
              className="object-cover"
              sizes="(max-width:768px) 100vw, 50vw"
              deliveryPreset={posterUrl ? "galleryStrip" : "none"}
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/35 transition group-hover:bg-black/45">
              <CirclePlay className="size-14 text-white drop-shadow-md" strokeWidth={1.25} aria-hidden />
            </span>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      {active || clickToLoad ? (
        <>
          {!fullscreenOpen ? (
            <div className="relative">
              <VideoElement
                sourceUrl={sourceUrl}
                posterUrl={posterUrl}
                videoClassName={videoClassName}
                title={title}
                videoRef={inlineVideoRef}
                autoPlay={clickToLoad && unlocked && !expandOnOpen}
              />
              <Button
                type="button"
                size="icon-sm"
                variant="secondary"
                className="absolute right-2 top-2 z-10 bg-black/55 text-white hover:bg-black/70"
                onClick={openFullscreen}
                aria-label={title ? `View ${title} full screen` : "View video full screen"}
              >
                <Maximize2 className="size-4" />
              </Button>
            </div>
          ) : null}

          <MediaFullscreenViewer
            open={fullscreenOpen}
            onClose={() => setFullscreenOpen(false)}
            title={title}
            ariaLabel={title ? `Full screen video: ${title}` : "Full screen video"}
            contentClassName="pb-8"
          >
            <VideoElement
              key={`fs-${sourceUrl}`}
              sourceUrl={sourceUrl}
              posterUrl={posterUrl}
              videoClassName={fullscreenVideoClassName}
              title={title}
              videoRef={fullscreenVideoRef}
              autoPlay
            />
          </MediaFullscreenViewer>
        </>
      ) : (
        <div
          className={`flex items-center justify-center rounded-lg bg-muted/80 text-xs text-muted-foreground dark:bg-black/50 ${videoClassName}`}
          aria-hidden
        >
          Scroll to load video…
        </div>
      )}
    </div>
  );
}
