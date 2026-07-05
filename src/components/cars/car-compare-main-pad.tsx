"use client";

import { useCarCompare } from "@/components/cars/car-compare-context";
import { cn } from "@/lib/utils";

/** Adds bottom padding when the fixed compare tray is visible so page content is not obscured. */
export function CarCompareMainPad({ children }: { children: React.ReactNode }) {
  const { entries, ready } = useCarCompare();
  return <div className={cn(ready && entries.length > 0 && "pb-28")}>{children}</div>;
}
