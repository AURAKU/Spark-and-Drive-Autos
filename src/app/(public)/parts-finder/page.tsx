import Link from "next/link";

import { PartsFinderCtaLink } from "@/components/parts-finder/parts-finder-cta-link";
import { PARTS_FINDER_HERO_LINE, PARTS_FINDER_PRODUCT_NAME } from "@/lib/parts-finder/marketing-copy";

export const dynamic = "force-dynamic";

export default function PartsFinderUpsellPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground dark:border-white/10 dark:bg-white/[0.03]">
        <h1 className="text-2xl font-semibold">{PARTS_FINDER_PRODUCT_NAME}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{PARTS_FINDER_HERO_LINE}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={`/login?callbackUrl=${encodeURIComponent("/parts-finder/entry")}`}
            className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-black"
          >
            Sign in to activate
          </Link>
          <PartsFinderCtaLink href="/parts-finder/entry" size="compact" className="!px-4">
            Open {PARTS_FINDER_PRODUCT_NAME}
          </PartsFinderCtaLink>
          <Link href="/parts-finder/activate" className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted/50">
            Activate or renew
          </Link>
          <PartsFinderCtaLink href="/parts-finder/search" size="compact" className="!px-4">
            Find Parts
          </PartsFinderCtaLink>
          <Link href="/parts" className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted/50">
            Continue browsing parts
          </Link>
        </div>
      </div>
    </div>
  );
}
