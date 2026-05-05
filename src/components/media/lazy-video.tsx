"use client";

import { useEffect, useRef, useState } from "react";
import { optimizeCloudinaryUrl, type CloudinaryDeliveryPreset } from "@/lib/cloudinary-delivery";

type Props = {
  src: string;
  poster?: string | null;
  className?: string;
  /** Classes on the `<video>` element (default `aspect-video w-full`). */
  videoClassName?: string;
  /** Featured / above-the-fold clip may preload metadata; others defer until visible. */
  featured?: boolean;
  /** Optional Cloudinary delivery transform for playback stream. */
  deliveryPreset?: CloudinaryDeliveryPreset;
  /** Optional label for the clip (accessibility). */
  title?: string;
};

/**
 * Defers loading `<video>` until near viewport to avoid N× bandwidth on pages with many clips.
 */
export function LazyVideo({
  src,
  poster,
  className,
  videoClassName = "aspect-video w-full",
  featured = false,
  deliveryPreset,
  title,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(featured);

  useEffect(() => {
    if (active) return;
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setActive(true);
      },
      { rootMargin: "160px", threshold: 0.01 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [active]);

  const sourceUrl = optimizeCloudinaryUrl(
    src,
    deliveryPreset ?? (featured ? "videoPremium" : "videoPreview"),
  );

  return (
    <div ref={wrapRef} className={className}>
      {active ? (
        <video
          controls
          className={videoClassName}
          poster={poster ?? undefined}
          preload={featured ? "metadata" : "none"}
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
