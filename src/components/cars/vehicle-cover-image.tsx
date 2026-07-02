"use client";

import type { RefObject } from "react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import type { CloudinaryDeliveryPreset } from "@/lib/cloudinary-delivery";
import { cloudinaryBlurPlaceholderUrl, optimizeCloudinaryUrl } from "@/lib/cloudinary-delivery";
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
} & ({ fill: true; width?: never; height?: never } | { fill?: false; width: number; height: number });

function shouldUnoptimizeImageUrl(url: string): boolean {
  if (!url.startsWith("http")) return false;
  if (url.includes("res.cloudinary.com")) return false;
  return true;
}

function useInView(enabled: boolean, rootMargin = "240px 0px") {
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
  } = props;
  const resolved = useMemo(() => {
    if (!src?.trim()) return VEHICLE_IMAGE_PLACEHOLDER_SRC;
    return optimizeCloudinaryUrl(src.trim(), deliveryPreset);
  }, [src, deliveryPreset]);

  const blurSrc = useMemo(() => cloudinaryBlurPlaceholderUrl(resolved), [resolved]);
  const deferLoad = !priority && loading !== "eager";
  const { ref, inView } = useInView(deferLoad);

  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [resolved]);

  const current = failed ? VEHICLE_IMAGE_PLACEHOLDER_SRC : resolved;
  const unoptimized = shouldUnoptimizeImageUrl(current);
  const showPlaceholder = imagePlaceholder && (!loaded || !inView) && !failed;

  const onError = () => {
    if (current !== VEHICLE_IMAGE_PLACEHOLDER_SRC) {
      setFailed(true);
    }
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

  if (props.fill) {
    return (
      <span ref={ref as RefObject<HTMLSpanElement>} className="relative block h-full w-full overflow-hidden">
        {placeholderLayer}
        {inView ? (
          <Image
            src={current}
            alt={alt}
            fill
            sizes={sizes}
            loading={priority ? undefined : loading}
            className={cn(
              className,
              "transition-opacity duration-300 ease-out will-change-transform",
              showPlaceholder ? "opacity-0" : "opacity-100",
            )}
            priority={priority}
            unoptimized={unoptimized}
            onError={onError}
            onLoad={() => setLoaded(true)}
          />
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
      {inView ? (
        <Image
          src={current}
          alt={alt}
          width={props.width}
          height={props.height}
          sizes={sizes}
          loading={priority ? undefined : loading}
          className={cn(
            className,
            "transition-opacity duration-300 ease-out",
            showPlaceholder ? "absolute inset-0 opacity-0" : "opacity-100",
          )}
          priority={priority}
          unoptimized={unoptimized}
          onError={onError}
          onLoad={() => setLoaded(true)}
        />
      ) : null}
    </span>
  );
}
