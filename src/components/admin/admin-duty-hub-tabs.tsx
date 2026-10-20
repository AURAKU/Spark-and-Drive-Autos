import Link from "next/link";

import { cn } from "@/lib/utils";

export function AdminDutyHubTabs(props: {
  active: "tracking" | "estimates";
  trackingHref: string;
  estimatesHref: string;
}) {
  const { active, trackingHref, estimatesHref } = props;
  return (
    <div
      className="flex flex-wrap gap-2 rounded-xl border border-border bg-muted/40 p-1.5 dark:border-white/10 dark:bg-white/[0.03]"
      role="tablist"
      aria-label="Duty hub sections"
    >
      <Link
        href={trackingHref}
        role="tab"
        aria-selected={active === "tracking"}
        className={cn(
          "rounded-lg px-3 py-1.5 text-sm font-medium transition",
          active === "tracking"
            ? "bg-[var(--brand)] text-black"
            : "text-foreground/80 hover:bg-muted hover:text-foreground dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white",
        )}
      >
        Duty tracking
      </Link>
      <Link
        href={estimatesHref}
        role="tab"
        aria-selected={active === "estimates"}
        className={cn(
          "rounded-lg px-3 py-1.5 text-sm font-medium transition",
          active === "estimates"
            ? "bg-[var(--brand)] text-black"
            : "text-foreground/80 hover:bg-muted hover:text-foreground dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white",
        )}
      >
        Duty estimates
      </Link>
    </div>
  );
}
