"use client";

import { CirclePlay } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { VehicleCoverImage } from "@/components/cars/vehicle-cover-image";
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
  /** Optional Cloudinary delivery transform for playback stream. */
  deliveryPreset?: CloudinaryDeliveryPreset;
  /** Optional label for the clip (accessibility). */
  title?: string;
};

/**
 * Defers loading `<video>` until near viewport, or until user taps when `clickToLoad` is set.
 */
export function LazyVideo({
  src,
  poster,
  className,
  videoClassName = "aspect-video w-full",
  featured = false,
  eagerMount = false,
  clickToLoad = false,
  deliveryPreset,
  title,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(() => Boolean(eagerMount) && !clickToLoad);
  const [unlocked, setUnlocked] = useState(() => !clickToLoad);

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
    if (!clickToLoad || !unlocked) return;
    void videoRef.current?.play().catch(() => {
      /* user may need to interact again on strict browsers */
    });
  }, [clickToLoad, unlocked]);

  const sourceUrl = optimizeCloudinaryUrl(
    src,
    deliveryPreset ?? (featured ? "videoPremium" : "videoPreview"),
  );

  const posterUrl = poster?.trim()
    ? optimizeCloudinaryUrl(poster.trim(), "galleryStrip")
    : undefined;

  const thumbSrc = posterUrl ?? VEHICLE_IMAGE_PLACEHOLDER_SRC;

  if (clickToLoad && !unlocked) {
    return (
      <div ref={wrapRef} className={className}>
        <button
          type="button"
          className="group relative block w-full overflow-hidden rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          aria-label={title ? `Load and play video: ${title}` : "Play video"}
          onClick={() => setUnlocked(true)}
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
    <div ref={wrapRef} className={className}>
      {active || clickToLoad ? (
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
