"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import type { CloudinaryDeliveryPreset } from "@/lib/cloudinary-delivery";
import { optimizeCloudinaryUrl } from "@/lib/cloudinary-delivery";
import { VEHICLE_IMAGE_PLACEHOLDER_SRC } from "@/lib/vehicle-image-fallback";

type Props = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** When set, Cloudinary URLs get bandwidth-friendly transforms; other URLs unchanged. */
  deliveryPreset?: CloudinaryDeliveryPreset;
} & ({ fill: true; width?: never; height?: never } | { fill?: false; width: number; height: number });

function shouldUnoptimizeImageUrl(url: string): boolean {
  if (!url.startsWith("http")) return false;
  if (url.includes("res.cloudinary.com")) return false;
  return true;
}

export function VehicleCoverImage(props: Props) {
  const { src, alt, className, sizes, priority, deliveryPreset = "none" } = props;
  const resolved = useMemo(() => {
    if (!src?.trim()) return VEHICLE_IMAGE_PLACEHOLDER_SRC;
    return optimizeCloudinaryUrl(src.trim(), deliveryPreset);
  }, [src, deliveryPreset]);

  const [current, setCurrent] = useState(resolved);

  useEffect(() => {
    setCurrent(resolved);
  }, [resolved]);

  const onError = () => {
    if (current !== VEHICLE_IMAGE_PLACEHOLDER_SRC) {
      setCurrent(VEHICLE_IMAGE_PLACEHOLDER_SRC);
    }
  };

  const unoptimized = shouldUnoptimizeImageUrl(current);

  if (props.fill) {
    return (
      <Image
        src={current}
        alt={alt}
        fill
        sizes={sizes}
        className={className}
        priority={priority}
        unoptimized={unoptimized}
        onError={onError}
      />
    );
  }

  return (
    <Image
      src={current}
      alt={alt}
      width={props.width}
      height={props.height}
      sizes={sizes}
      className={className}
      priority={priority}
      unoptimized={unoptimized}
      onError={onError}
    />
  );
}
