import Link from "next/link";

import { cn } from "@/lib/utils";

export type AdminPartsFinderHubView = "overview" | "verified-parts" | "parts-request-fee";

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
      {tab("/admin/parts-finder?view=verified-parts", "Verified part requests", "verified-parts")}
      {tab("/admin/parts-finder/parts-request-fee", "Parts request fee", "parts-request-fee")}
      <Link
        href="/admin/identity"
        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted/40"
      >
        Identity hub →
      </Link>
    </div>
  );
}
