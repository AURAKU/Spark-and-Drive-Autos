"use client";

import { useEffect, useState } from "react";

import { optimizeCloudinaryUrl, type CloudinaryDeliveryPreset } from "@/lib/cloudinary-delivery";
import { prefetchMediaUrl, runWhenBrowserIdle } from "@/lib/media/media-load-scheduler";

/** Prefetch the next/previous slide immediately, then idle-warm the rest in pairs. */
export function useGalleryMediaPreload(
  urls: string[],
  activeIndex: number,
  preset: CloudinaryDeliveryPreset,
) {
  useEffect(() => {
    if (urls.length <= 1) return;
    const count = urls.length;
    const next = urls[(activeIndex + 1) % count];
    const prev = urls[(activeIndex - 1 + count) % count];
    const cancels: Array<() => void> = [];
    if (next) cancels.push(prefetchMediaUrl(optimizeCloudinaryUrl(next, preset), "adjacent"));
    if (prev && prev !== next) {
      cancels.push(prefetchMediaUrl(optimizeCloudinaryUrl(prev, preset), "adjacent"));
    }
    return () => {
      for (const stop of cancels) stop();
    };
  }, [urls, activeIndex, preset]);

  useEffect(() => {
    if (urls.length <= 3) return;
    const leftovers = urls.filter((_, i) => i !== activeIndex);
    let cursor = 0;
    const stops: Array<() => void> = [];
    const cancelIdle = runWhenBrowserIdle(() => {
      const tick = () => {
        const slice = leftovers.slice(cursor, cursor + 2);
        cursor += 2;
        for (const url of slice) {
          stops.push(prefetchMediaUrl(optimizeCloudinaryUrl(url, preset), "idle"));
        }
        if (cursor < leftovers.length) {
          stops.push(runWhenBrowserIdle(tick, 900));
        }
      };
      tick();
    }, 900);
    return () => {
      cancelIdle();
      for (const stop of stops) stop();
    };
  }, [urls, activeIndex, preset]);
}

/** Unlock gallery thumbs in chunks so the hero request is not drowned. */
export function useChunkedThumbCount(total: number, activeIndex: number, initial = 6) {
  const [visible, setVisible] = useState(() => Math.min(initial, total));

  useEffect(() => {
    setVisible((n) => Math.min(total, Math.max(n, initial, activeIndex + 3)));
  }, [activeIndex, total, initial]);

  useEffect(() => {
    if (visible >= total) return;
    return runWhenBrowserIdle(() => {
      setVisible((n) => Math.min(total, n + 4));
    }, 700);
  }, [visible, total]);

  return visible;
}
