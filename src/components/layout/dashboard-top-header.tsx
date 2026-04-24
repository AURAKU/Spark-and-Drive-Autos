import Image from "next/image";
import Link from "next/link";

import { PartnerBrandStrip } from "@/components/brand/partner-brand-strip";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PartsFinderCtaLink } from "@/components/parts-finder/parts-finder-cta-link";
import { BrowseCarsCtaLink, BuyPartsCtaLink } from "@/components/storefront/storefront-cta-links";
import { PARTS_FINDER_PRODUCT_NAME } from "@/lib/parts-finder/marketing-copy";

export function DashboardTopHeader({ showPartnerStrip = true }: { showPartnerStrip?: boolean }) {
  return (
    <header className="relative shrink-0 border-b border-border bg-background/95 backdrop-blur-sm dark:border-white/10 dark:bg-zinc-950">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.09]"
        style={{
          backgroundImage: "url(/brand/brand-hero-texture.png)",
          backgroundSize: "cover",
          backgroundPosition: "50% 30%",
        }}
      />
      <div className="relative border-b border-[var(--brand)]/15 bg-gradient-to-r from-[var(--brand)]/[0.06] via-transparent to-emerald-500/[0.04]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:py-6">
          <div className="flex min-w-0 items-start gap-4 sm:items-center">
            <Link href="/" aria-label="Go to landing page" title="Home" className="relative shrink-0">
              <div className="absolute -inset-1 rounded-full bg-[var(--brand)]/25 blur-md" aria-hidden />
              <Image
                src="/brand/logo-emblem.png"
                alt="Spark and Drive Autos emblem"
                width={72}
                height={72}
                className="relative size-16 rounded-full border border-[var(--brand)]/40 object-cover shadow-[0_0_24px_-4px_rgba(20,216,230,0.5)] transition hover:border-[var(--brand)]/70 sm:size-[4.5rem]"
                priority
              />
            </Link>
            <div className="min-w-0">
              <h1 className="font-bold tracking-[0.06em] text-foreground uppercase sm:tracking-[0.08em] dark:text-white">
                <span className="block text-xl leading-none sm:inline sm:text-2xl md:text-3xl lg:text-4xl">
                  SPARK AND DRIVE{" "}
                </span>
                <span className="mt-1 block text-xl leading-none sm:mt-0 sm:inline sm:text-2xl md:text-3xl lg:text-4xl">
                  AUTOS
                </span>
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base md:text-lg">
                Drive with confidence premium and reliable imports, SUVs, and next-generation electric and hybrid
                vehicles, all carefully selected for quality and performance.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end lg:flex-row lg:items-center">
            <ThemeToggle />
            <BuyPartsCtaLink size="compact" className="!px-3.5 text-xs" href="/parts" />
            <PartsFinderCtaLink href="/parts-finder/entry" size="compact" className="!px-4 text-xs">
              {PARTS_FINDER_PRODUCT_NAME}
            </PartsFinderCtaLink>
            <BrowseCarsCtaLink size="compact" className="!px-3.5 text-xs" href="/inventory" />
          </div>
        </div>
      </div>
      {showPartnerStrip ? <PartnerBrandStrip /> : null}
    </header>
  );
}
