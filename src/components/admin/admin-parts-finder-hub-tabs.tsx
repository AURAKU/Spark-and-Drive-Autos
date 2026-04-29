import Link from "next/link";

import { cn } from "@/lib/utils";

export type AdminPartsFinderHubView = "overview" | "verifications" | "verified-parts";

export function AdminPartsFinderHubTabs(props: { active: AdminPartsFinderHubView }) {
  const { active } = props;
  const tab = (href: string, label: string, id: AdminPartsFinderHubView) => (
    <Link
      href={href}
      role="tab"
      aria-selected={active === id}
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm font-medium transition",
        active === id
          ? "bg-[var(--brand)] text-black"
          : "border border-border text-foreground hover:bg-muted/40",
      )}
    >
      {label}
    </Link>
  );
  return (
    <div className="mb-8 flex flex-wrap gap-2" role="tablist" aria-label="Parts finder admin sections">
      {tab("/admin/parts-finder", "Overview", "overview")}
      {tab("/admin/parts-finder?view=verifications", "Identity verifications", "verifications")}
      {tab("/admin/parts-finder?view=verified-parts", "Verified part requests", "verified-parts")}
    </div>
  );
}
