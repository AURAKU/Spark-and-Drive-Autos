"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { VEHICLE_IMAGE_PLACEHOLDER_SRC } from "@/lib/vehicle-image-fallback";

type Props = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
} & ({ fill: true; width?: never; height?: never } | { fill?: false; width: number; height: number });

export function VehicleCoverImage(props: Props) {
  const { src, alt, className, sizes, priority } = props;
  const [current, setCurrent] = useState(src);

  useEffect(() => {
    setCurrent(src);
  }, [src]);

  const onError = () => {
    if (current !== VEHICLE_IMAGE_PLACEHOLDER_SRC) {
      setCurrent(VEHICLE_IMAGE_PLACEHOLDER_SRC);
    }
  };

  const unoptimized = current.startsWith("http");

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
