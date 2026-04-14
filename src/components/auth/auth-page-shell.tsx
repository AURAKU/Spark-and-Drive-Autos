import type { ReactNode } from "react";

import { PageHeading } from "@/components/typography/page-headings";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Consistent auth layout: readable width, card surface, spacing tuned for mobile tap targets.
 * Surfaces use theme tokens so copy stays legible in light and dark mode.
 */
export function AuthPageShell({ title, description, children, footer }: Props) {
  return (
    <div className="mx-auto w-full max-w-[440px] px-4 py-12 sm:py-16 md:py-20">
      <div
        className={cn(
          "rounded-2xl border p-6 shadow-xl backdrop-blur-sm sm:p-8",
          "border-border bg-card/95 text-card-foreground shadow-black/10 ring-1 ring-border/50",
          "dark:border-white/[0.08] dark:bg-[oklch(0.18_0.02_250_/_0.65)] dark:shadow-black/25 dark:ring-white/[0.06]",
        )}
      >
        <header className="space-y-2 text-center sm:text-left">
          <PageHeading variant="auth">{title}</PageHeading>
          {description ? (
            <p className="text-sm leading-relaxed text-muted-foreground dark:text-zinc-400">{description}</p>
          ) : null}
        </header>
        <div className="mt-8">{children}</div>
        {footer ? (
          <div className="mt-8 border-t border-border pt-6 dark:border-white/10">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
