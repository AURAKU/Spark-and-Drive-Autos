"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { useCarCompare } from "@/components/cars/car-compare-context";

/** When `/compare` has no `cars` query but two vehicles are selected, open the side-by-side view. */
export function CarCompareAutoRedirect() {
  const { compareHref, ready } = useCarCompare();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!ready || searchParams.has("cars")) return;
    if (!compareHref) return;
    router.replace(compareHref);
  }, [compareHref, ready, router, searchParams]);

  return null;
}
