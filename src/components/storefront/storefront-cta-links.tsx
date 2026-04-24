import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/** Teal / brand glass CTA — matches landing “Browse cars”. */
export const browseCarsCtaClassName = cn(
  "inline-flex items-center justify-center rounded-xl border-2 border-[var(--brand)] bg-[var(--brand)]/[0.14]",
  "font-semibold tracking-wide text-[var(--brand)]",
  "shadow-[0_0_36px_-6px_rgba(20,216,230,0.55)] transition",
  "hover:border-[var(--brand)] hover:bg-[var(--brand)]/25",
);

/** Red CTA — matches landing “Buy Parts & Accessories”. */
export const buyPartsCtaClassName = cn(
  "inline-flex items-center justify-center rounded-xl border border-white/90 bg-red-600",
  "text-center font-semibold leading-snug tracking-wide text-white",
  "shadow-[0_8px_28px_-6px_rgba(220,38,38,0.55)] transition hover:bg-red-700",
);

const browseSizes = {
  /** Hero row: same flex behavior as home */
  default:
    "min-h-12 w-full min-w-0 flex-1 justify-center px-6 text-sm sm:min-w-[11.5rem] sm:flex-none",
  /** Headers, footer, inline */
  compact: "h-9 min-h-9 justify-center px-4 text-xs",
} as const;

const buySizes = {
  default:
    "min-h-12 w-full min-w-0 flex-1 justify-center px-5 text-sm sm:min-w-[11.5rem] sm:flex-none sm:px-6",
  compact: "h-9 min-h-9 justify-center px-4 text-xs leading-tight",
} as const;

export type StorefrontCtaSize = keyof typeof browseSizes;

type LinkProps = ComponentProps<typeof Link>;

const DEFAULT_BROWSE = "Browse cars";
const DEFAULT_BUY = "Buy Parts & Accessories";

export function BrowseCarsCtaLink({
  href = "/inventory",
  children = DEFAULT_BROWSE,
  size = "default",
  className,
  ...rest
}: Omit<LinkProps, "className" | "children" | "href" | "size"> & {
  href?: LinkProps["href"];
  size?: StorefrontCtaSize;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Link href={href} className={cn(browseCarsCtaClassName, browseSizes[size], className)} {...rest}>
      {children}
    </Link>
  );
}

export function BuyPartsCtaLink({
  href = "/parts",
  children = DEFAULT_BUY,
  size = "default",
  className,
  ...rest
}: Omit<LinkProps, "className" | "children" | "href" | "size"> & {
  href?: LinkProps["href"];
  size?: StorefrontCtaSize;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Link href={href} className={cn(buyPartsCtaClassName, buySizes[size], className)} {...rest}>
      {children}
    </Link>
  );
}
