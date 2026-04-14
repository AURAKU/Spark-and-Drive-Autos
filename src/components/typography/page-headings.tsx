import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Glow tracks `--brand` (teal site-wide, red inside `.parts-theme`). */
const brandGlow = "drop-shadow-[0_0_18px_color-mix(in_srgb,var(--brand)_38%,transparent)]";
const brandGlowStrong = "drop-shadow-[0_0_24px_color-mix(in_srgb,var(--brand)_42%,transparent)]";

const pageVariants = {
  /** Full-width underline — FAQ, Contact, legal index, marketing copy pages */
  document: cn(
    "border-b border-[var(--brand)]/50 pb-3 text-3xl font-bold tracking-tight text-[var(--brand)] sm:text-4xl",
    brandGlowStrong,
  ),
  /** Left accent — dashboard, admin, compact flows */
  dashboard: cn(
    "border-l-[3px] border-[var(--brand)] pl-4 text-2xl font-bold tracking-tight text-[var(--brand)]",
    brandGlow,
  ),
  /** Large display — inventory hero, landing emphasis */
  hero: cn(
    "text-4xl font-bold leading-tight tracking-tight text-[var(--brand)] sm:text-5xl",
    brandGlowStrong,
  ),
  /** Auth cards and narrow forms */
  auth: cn("text-2xl font-bold tracking-tight text-[var(--brand)] sm:text-[1.65rem]", brandGlow),
  /** Vehicle / part detail titles */
  product: cn(
    "text-3xl font-bold tracking-tight text-[var(--brand)] sm:text-4xl lg:text-5xl",
    brandGlowStrong,
  ),
} as const;

export type PageHeadingVariant = keyof typeof pageVariants;

export function PageHeading({
  children,
  className,
  variant = "document",
  align = "left",
}: {
  children: ReactNode;
  className?: string;
  variant?: PageHeadingVariant;
  align?: "left" | "center";
}) {
  return (
    <h1 className={cn(pageVariants[variant], align === "center" && "text-center", className)}>{children}</h1>
  );
}

const sectionSizes = {
  default: cn("text-xl font-bold tracking-tight sm:text-2xl", brandGlow),
  compact: cn(
    "text-base font-bold leading-snug sm:text-lg",
    "drop-shadow-[0_0_14px_color-mix(in_srgb,var(--brand)_30%,transparent)]",
  ),
} as const;

export type SectionHeadingSize = keyof typeof sectionSizes;

export function SectionHeading({
  children,
  className,
  size = "default",
}: {
  children: ReactNode;
  className?: string;
  size?: SectionHeadingSize;
}) {
  return (
    <h2
      className={cn(
        "border-l-[3px] border-[var(--brand)] pl-4 text-[var(--brand)]",
        sectionSizes[size],
        className,
      )}
    >
      {children}
    </h2>
  );
}
