"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import type { CloudinaryDeliveryPreset } from "@/lib/cloudinary-delivery";
import { optimizeCloudinaryUrl } from "@/lib/cloudinary-delivery";
import { VEHICLE_IMAGE_PLACEHOLDER_SRC } from "@/lib/vehicle-image-fallback";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  loading?: "lazy" | "eager";
  /** Pulse skeleton until the image finishes loading (reduces layout flash). */
  imagePlaceholder?: boolean;
  /** When set, Cloudinary URLs get bandwidth-friendly transforms; other URLs unchanged. */
  deliveryPreset?: CloudinaryDeliveryPreset;
} & ({ fill: true; width?: never; height?: never } | { fill?: false; width: number; height: number });

function shouldUnoptimizeImageUrl(url: string): boolean {
  if (!url.startsWith("http")) return false;
  if (url.includes("res.cloudinary.com")) return false;
  return true;
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

  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [resolved]);

  const current = failed ? VEHICLE_IMAGE_PLACEHOLDER_SRC : resolved;
  const unoptimized = shouldUnoptimizeImageUrl(current);

  const onError = () => {
    if (current !== VEHICLE_IMAGE_PLACEHOLDER_SRC) {
      setFailed(true);
    }
  };

  const showSkeleton = imagePlaceholder && !loaded && !failed;

  if (props.fill) {
    return (
      <span className="relative block h-full w-full">
        {showSkeleton ? (
          <span
            className="absolute inset-0 animate-pulse bg-muted dark:bg-zinc-800"
            aria-hidden
          />
        ) : null}
        <Image
          src={current}
          alt={alt}
          fill
          sizes={sizes}
          loading={loading}
          className={cn(
            className,
            showSkeleton ? "opacity-0" : "opacity-100 transition-opacity duration-200",
          )}
          priority={priority}
          unoptimized={unoptimized}
          onError={onError}
          onLoadingComplete={() => setLoaded(true)}
        />
      </span>
    );
  }

  return (
    <>
      {showSkeleton ? (
        <span
          className={cn(
            "block animate-pulse rounded bg-muted dark:bg-zinc-800",
            className,
          )}
          style={{ width: props.width, height: props.height }}
          aria-hidden
        />
      ) : null}
      <Image
        src={current}
        alt={alt}
        width={props.width}
        height={props.height}
        sizes={sizes}
        loading={loading}
        className={cn(className, showSkeleton ? "hidden" : undefined)}
        priority={priority}
        unoptimized={unoptimized}
        onError={onError}
        onLoadingComplete={() => setLoaded(true)}
      />
    </>
  );
}
