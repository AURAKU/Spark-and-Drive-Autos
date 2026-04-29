import Link from "next/link";

import { cn } from "@/lib/utils";

export function AdminDutyHubTabs(props: {
  active: "tracking" | "estimates";
  trackingHref: string;
  estimatesHref: string;
}) {
  const { active, trackingHref, estimatesHref } = props;
  return (
    <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1.5" role="tablist" aria-label="Duty hub sections">
      <Link
        href={trackingHref}
        role="tab"
        aria-selected={active === "tracking"}
        className={cn(
          "rounded-lg px-3 py-1.5 text-sm font-medium transition",
          active === "tracking"
            ? "bg-[var(--brand)] text-black"
            : "text-zinc-300 hover:bg-white/10 hover:text-white",
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
            : "text-zinc-300 hover:bg-white/10 hover:text-white",
        )}
      >
        Duty estimates
      </Link>
    </div>
  );
}
