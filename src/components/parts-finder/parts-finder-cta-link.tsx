import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";

import { PARTS_FINDER_PRODUCT_NAME } from "@/lib/parts-finder/marketing-copy";
import { cn } from "@/lib/utils";

/** Shared orange “Spark Parts Finder” CTA (matches landing hero). */
export const partsFinderCtaClassName = cn(
  "inline-flex items-center justify-center rounded-lg border border-orange-300 bg-orange-500",
  "font-semibold tracking-wide text-black shadow-[0_8px_22px_-8px_rgba(249,115,22,0.6)]",
  "transition hover:bg-orange-600 hover:text-black",
  "dark:border-orange-400 dark:bg-orange-500 dark:text-white dark:hover:bg-orange-600 dark:hover:text-white",
);

const sizeClass = {
  default: "h-10 min-h-10 px-4 text-base",
  compact: "h-9 min-h-9 px-3 text-xs",
  /** Dashboard / mobile nav — full width */
  nav: "h-9 min-h-9 w-full justify-center px-3 text-sm",
} as const;

export type PartsFinderCtaSize = keyof typeof sizeClass;

type LinkProps = ComponentProps<typeof Link>;

export function PartsFinderCtaLink({
  href = "/parts-finder/entry",
  children = PARTS_FINDER_PRODUCT_NAME,
  size = "default",
  className,
  ...rest
}: Omit<LinkProps, "className" | "children" | "href" | "size"> & {
  href?: LinkProps["href"];
  size?: PartsFinderCtaSize;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Link href={href} className={cn(partsFinderCtaClassName, sizeClass[size], className)} {...rest}>
      {children}
    </Link>
  );
}
