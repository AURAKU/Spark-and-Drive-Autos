"use client";

import { useState } from "react";

import { normalizePartsFinderImageUrl } from "@/lib/parts-finder/image-url";

type PartsFinderProxiedImageProps = {
  imageUrl: string;
  alt: string;
  imgClassName?: string;
  placeholderClassName?: string;
};

/**
 * Renders a proxied part image; on load failure, shows a neutral placeholder (broken CDN / hotlink).
 */
export function PartsFinderProxiedImage({
  imageUrl,
  alt,
  imgClassName = "min-h-64 max-h-96 w-full rounded-md border border-border bg-black/5 object-contain p-2",
  placeholderClassName = "flex min-h-64 w-full max-h-96 items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-2 text-center text-xs text-muted-foreground",
}: PartsFinderProxiedImageProps) {
  const [failed, setFailed] = useState(false);
  const normalized = normalizePartsFinderImageUrl(imageUrl);
  if (!normalized || failed) {
    return <div className={placeholderClassName}>Product image unavailable</div>;
  }
  const proxy = `/api/parts-finder/image?url=${encodeURIComponent(normalized)}`;
  return (
    <a href={proxy} target="_blank" rel="noreferrer" className="block w-full">
      {/* Same-origin proxy URL; needs native onError for graceful fallback. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- proxied same-origin, dynamic per search */}
      <img
        src={proxy}
        alt={alt}
        className={imgClassName}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </a>
  );
}
