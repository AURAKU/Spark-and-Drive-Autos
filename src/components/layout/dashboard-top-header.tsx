import Image from "next/image";
import Link from "next/link";

import { PartnerBrandStrip } from "@/components/brand/partner-brand-strip";
import { ThemeToggle } from "@/components/layout/theme-toggle";

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
            <div className="relative shrink-0">
              <div className="absolute -inset-1 rounded-full bg-[var(--brand)]/25 blur-md" aria-hidden />
              <Image
                src="/brand/logo-emblem.png"
                alt="Spark and Drive Autos emblem"
                width={72}
                height={72}
                className="relative size-16 rounded-full border border-[var(--brand)]/40 object-cover shadow-[0_0_24px_-4px_rgba(20,216,230,0.5)] sm:size-[4.5rem]"
                priority
              />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.35em] text-[var(--brand)] uppercase sm:text-[11px]">
                Spark and Drive Autos
              </p>
              <h1 className="mt-1.5 font-bold tracking-[0.06em] text-foreground uppercase sm:tracking-[0.08em] dark:text-white">
                <span className="block text-xl leading-none sm:inline sm:text-2xl md:text-3xl lg:text-4xl">
                  SPARK AND DRIVE{" "}
                </span>
                <span className="mt-1 block text-xl leading-none text-emerald-400 sm:mt-0 sm:inline sm:text-2xl md:text-3xl lg:text-4xl">
                  AUTOS
                </span>
              </h1>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Drive the future with confidence, with curated inventory from Ghana, China, and in-transit sourcing.
                Toyota Crown class imports, Korean SUVs, and leading Chinese EV and hybrid brands.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end lg:flex-row lg:items-center">
            <Link
              href="/"
              aria-label="Home"
              title="Home"
              className="relative inline-flex size-9 items-center justify-center rounded-full border border-border bg-muted/50 transition hover:border-[var(--brand)]/45 hover:bg-muted dark:border-white/20 dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
            >
              <Image src="/brand/logo-emblem.png" alt="Spark and Drive Autos logo" fill className="rounded-full object-cover p-1" />
            </Link>
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-card px-4 text-xs font-medium text-foreground transition hover:border-[var(--brand)]/40 hover:bg-muted dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.07]"
            >
              Storefront
            </Link>
            <Link
              href="/inventory"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--brand)] px-4 text-xs font-semibold text-black transition hover:opacity-90"
            >
              Browse inventory
            </Link>
          </div>
        </div>
      </div>
      {showPartnerStrip ? <PartnerBrandStrip /> : null}
    </header>
  );
}
