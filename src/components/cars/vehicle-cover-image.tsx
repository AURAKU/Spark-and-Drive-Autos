"use client";

import type { RefObject } from "react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import type { CloudinaryDeliveryPreset } from "@/lib/cloudinary-delivery";
import {
  cloudinaryBlurPlaceholderUrl,
  cloudinarySrcSet,
  forceCloudinaryJpegUrl,
  isCloudinaryMediaUrl,
  optimizeCloudinaryUrl,
  shouldBypassNextImageOptimizer,
} from "@/lib/cloudinary-delivery";
import { acquireMediaSlot, type MediaLoadPriority } from "@/lib/media/media-load-scheduler";
import { VEHICLE_IMAGE_PLACEHOLDER_SRC } from "@/lib/vehicle-image-fallback";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  loading?: "lazy" | "eager";
  /** Pulse skeleton + blur-up until the image finishes loading (reduces layout flash). */
  imagePlaceholder?: boolean;
  /** When set, Cloudinary URLs get bandwidth-friendly transforms; other URLs unchanged. */
  deliveryPreset?: CloudinaryDeliveryPreset;
  /** After the display image paints, idle-upgrade to this higher-fidelity preset. */
  upgradePreset?: CloudinaryDeliveryPreset;
  /** Scheduler rank. Hero is granted immediately; idle waits until the lane is free. */
  chunkPriority?: MediaLoadPriority;
} & ({ fill: true; width?: never; height?: never } | { fill?: false; width: number; height: number });

function shouldUnoptimizeImageUrl(url: string): boolean {
  if (!url.startsWith("http")) return false;
  return shouldBypassNextImageOptimizer(url);
}

function useInView(enabled: boolean, rootMargin = "280px 0px") {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setInView(true);
      return;
    }
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  return { ref, inView };
}

function useMediaLane(enabled: boolean, priority: MediaLoadPriority) {
  const [granted, setGranted] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setGranted(true);
      return;
    }
    const slot = acquireMediaSlot(priority);
    let active = true;
    void slot.ready.then(() => {
      if (active) setGranted(true);
    });
    return () => {
      active = false;
      slot.release();
    };
  }, [enabled, priority]);

  return granted;
}

export function VehicleCoverImage(props: Props) {
  const {
    src,
    alt,
    className,
    sizes,
    priority,
    loading = "lazy",
    imagePlaceholder = false,
    deliveryPreset = "none",
    upgradePreset,
    chunkPriority,
  } = props;

  const resolved = useMemo(() => {
    if (!src?.trim()) return VEHICLE_IMAGE_PLACEHOLDER_SRC;
    return optimizeCloudinaryUrl(src.trim(), deliveryPreset);
  }, [src, deliveryPreset]);

  const responsive = useMemo(() => {
    if (!src?.trim() || !isCloudinaryMediaUrl(src)) return { src: resolved };
    return cloudinarySrcSet(src.trim(), deliveryPreset);
  }, [src, deliveryPreset, resolved]);

  const upgradeSrc = useMemo(() => {
    if (!upgradePreset || !src?.trim() || !isCloudinaryMediaUrl(src)) return null;
    return optimizeCloudinaryUrl(src.trim(), upgradePreset);
  }, [src, upgradePreset]);

  const blurSrc = useMemo(() => cloudinaryBlurPlaceholderUrl(src || resolved), [src, resolved]);
  const deferLoad = !priority && loading !== "eager";
  const { ref, inView } = useInView(deferLoad);
  const lanePriority = chunkPriority ?? (priority || loading === "eager" ? "hero" : "visible");
  const granted = useMediaLane(inView && deferLoad, lanePriority);
  const canFetch = inView && (priority || loading === "eager" || granted);

  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [displaySrc, setDisplaySrc] = useState(responsive.src);
  const [displaySrcSet, setDisplaySrcSet] = useState(responsive.srcSet);
  const [paintedSrc, setPaintedSrc] = useState<string | null>(null);
  const [hiResReady, setHiResReady] = useState(false);
  const retryKey = useRef(0);

  useEffect(() => {
    retryKey.current = 0;
    setFailed(false);
    setLoaded(false);
    setHiResReady(false);
    setDisplaySrc(responsive.src);
    setDisplaySrcSet(responsive.srcSet);
  }, [responsive.src, responsive.srcSet]);

  useEffect(() => {
    if (!upgradeSrc || !loaded || failed || !canFetch) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;
    let cancelled = false;
    const idle = window.requestIdleCallback?.bind(window);
    const start = () => {
      const img = document.createElement("img");
      img.decoding = "async";
      img.onload = () => {
        if (cancelled) return;
        setDisplaySrc(upgradeSrc);
        setDisplaySrcSet(undefined);
        setHiResReady(true);
      };
      img.src = upgradeSrc;
    };
    if (idle) {
      const id = idle(start, { timeout: 1800 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(id);
      };
    }
    const id = window.setTimeout(start, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [upgradeSrc, loaded, failed, canFetch]);

  const current = failed ? VEHICLE_IMAGE_PLACEHOLDER_SRC : displaySrc;
  const unoptimized = shouldUnoptimizeImageUrl(current);
  const showPlaceholder = imagePlaceholder && !paintedSrc && (!loaded || !canFetch) && !failed;
  const cloudinaryNative = isCloudinaryMediaUrl(src) && !failed;
  const originalUrl = src?.trim() ?? "";
  const jpegFallback = originalUrl ? forceCloudinaryJpegUrl(optimizeCloudinaryUrl(originalUrl, deliveryPreset)) : null;
  const imgKey = `${current}|${displaySrcSet ?? ""}|${retryKey.current}`;

  const onError = () => {
    if (current === VEHICLE_IMAGE_PLACEHOLDER_SRC) return;
    // 1) Safari often errors the whole <img> when srcset commas parse as extra candidates.
    if (displaySrcSet) {
      retryKey.current += 1;
      setDisplaySrcSet(undefined);
      return;
    }
    // 2) AVIF/auto-format decode failures — retry as JPEG.
    if (jpegFallback && displaySrc !== jpegFallback) {
      retryKey.current += 1;
      setDisplaySrc(jpegFallback);
      return;
    }
    // 3) Last photo attempt: the stored URL with no delivery rewrite.
    if (originalUrl && displaySrc !== originalUrl && originalUrl !== VEHICLE_IMAGE_PLACEHOLDER_SRC) {
      retryKey.current += 1;
      setDisplaySrc(originalUrl);
      return;
    }
    setFailed(true);
  };

  const placeholderLayer = showPlaceholder ? (
    <>
      {blurSrc ? (
        <span
          className="absolute inset-0 scale-110 bg-cover bg-center blur-md"
          style={{ backgroundImage: `url("${blurSrc}")` }}
          aria-hidden
        />
      ) : null}
      <span
        className={cn(
          "absolute inset-0 bg-muted/80 dark:bg-zinc-800/80",
          !blurSrc && "animate-pulse",
        )}
        aria-hidden
      />
    </>
  ) : null;

  const commonClass = cn(
    className,
    "transition-opacity duration-300 ease-out will-change-transform",
    showPlaceholder ? "opacity-0" : "opacity-100",
  );

  if (props.fill) {
    return (
      <span ref={ref as RefObject<HTMLSpanElement>} className="relative block h-full w-full overflow-hidden">
        {placeholderLayer}
        {paintedSrc && paintedSrc !== current ? (
          // eslint-disable-next-line @next/next/no-img-element -- keep last sharp frame while the next decode finishes
          <img src={paintedSrc} alt="" className={cn("absolute inset-0 h-full w-full", className)} aria-hidden />
        ) : null}
        {canFetch && cloudinaryNative ? (
          // eslint-disable-next-line @next/next/no-img-element -- Cloudinary srcset + no Next re-encode
          <img
            key={imgKey}
            src={current}
            srcSet={hiResReady ? undefined : displaySrcSet}
            sizes={sizes}
            alt={alt}
            decoding="async"
            fetchPriority={priority ? "high" : deferLoad ? "low" : "auto"}
            loading={priority ? "eager" : loading}
            className={cn("absolute inset-0 h-full w-full", commonClass)}
            onError={onError}
            onLoad={() => {
              setLoaded(true);
              setPaintedSrc(current);
            }}
          />
        ) : canFetch ? (
          <Image
            key={imgKey}
            src={current}
            alt={alt}
            fill
            sizes={sizes}
            loading={priority ? undefined : loading}
            className={commonClass}
            priority={priority}
            unoptimized={unoptimized}
            onError={onError}
            onLoad={() => {
              setLoaded(true);
              setPaintedSrc(current);
            }}
          />
        ) : paintedSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- hold last frame while the next slot is granted
          <img src={paintedSrc} alt={alt} className={cn("absolute inset-0 h-full w-full", className)} />
        ) : null}
      </span>
    );
  }

  return (
    <span ref={ref as RefObject<HTMLSpanElement>} className="relative inline-block overflow-hidden">
      {showPlaceholder ? (
        <span
          className={cn("relative block animate-pulse bg-muted dark:bg-zinc-800", className)}
          style={{ width: props.width, height: props.height }}
          aria-hidden
        >
          {blurSrc ? (
            <span
              className="absolute inset-0 scale-110 bg-cover bg-center blur-md"
              style={{ backgroundImage: `url("${blurSrc}")` }}
              aria-hidden
            />
          ) : null}
        </span>
      ) : null}
      {canFetch && cloudinaryNative ? (
        // eslint-disable-next-line @next/next/no-img-element -- Cloudinary srcset + no Next re-encode
        <img
          key={imgKey}
          src={current}
          srcSet={hiResReady ? undefined : displaySrcSet}
          sizes={sizes}
          alt={alt}
          width={props.width}
          height={props.height}
          decoding="async"
          fetchPriority={priority ? "high" : deferLoad ? "low" : "auto"}
          loading={priority ? "eager" : loading}
          className={cn(commonClass, showPlaceholder ? "absolute inset-0" : undefined)}
          onError={onError}
          onLoad={() => {
            setLoaded(true);
            setPaintedSrc(current);
          }}
        />
      ) : canFetch ? (
        <Image
          key={imgKey}
          src={current}
          alt={alt}
          width={props.width}
          height={props.height}
          sizes={sizes}
          loading={priority ? undefined : loading}
          className={cn(commonClass, showPlaceholder ? "absolute inset-0" : undefined)}
          priority={priority}
          unoptimized={unoptimized}
          onError={onError}
          onLoad={() => {
            setLoaded(true);
            setPaintedSrc(current);
          }}
        />
      ) : null}
    </span>
  );
}
