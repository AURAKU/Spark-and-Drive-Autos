"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

/**
 * Dashboard partner marques. Six logos show at a time, then fade out for the next set.
 * Logos are Wikimedia Commons / enwiki-served assets (trademarks of their owners), shown on a white badge for contrast in light and dark UI.
 */
type BrandCell = { label: string; logoSrc: string };

const COUNTRY_FLAGS = [
  { label: "JAPAN", flag: "🇯🇵" },
  { label: "KOREA", flag: "🇰🇷" },
  { label: "CHINA", flag: "🇨🇳" },
  { label: "USA", flag: "🇺🇸" },
  { label: "CANADA", flag: "🇨🇦" },
  { label: "UAE", flag: "🇦🇪" },
  { label: "GHANA", flag: "🇬🇭" },
] as const;

/**
 * Row 1: global marques · Row 2: Chinese volume / EV (incl. GAC group mark via GAC Gonow logo on Commons).
 * URLs resolved from Commons `File:` pages (verified HTTP 200).
 */
const DASHBOARD_PARTNER_BRANDS: BrandCell[] = [
  { label: "Toyota", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/9/9d/Toyota_carlogo.svg" },
  { label: "Honda", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/3/38/Honda.svg" },
  { label: "Nissan", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/2/23/Nissan_2020_logo.svg" },
  { label: "Hyundai", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/4/44/Hyundai_Motor_Company_logo.svg" },
  { label: "Kia", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/b/b6/KIA_logo3.svg" },
  { label: "BMW", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/4/44/BMW.svg" },
  {
    label: "Mercedes-Benz",
    logoSrc: "https://upload.wikimedia.org/wikipedia/commons/9/9e/Mercedes-Benz_%282025%29.svg",
  },
  { label: "Audi", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/9/92/Audi-Logo_2016.svg" },
  { label: "Volkswagen", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/6/6d/Volkswagen_logo_2019.svg" },
  { label: "Ford", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/a/a0/Ford_Motor_Company_Logo.svg" },
  { label: "Tesla", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/b/bd/Tesla_Motors.svg" },
  { label: "Porsche", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/1/12/Porsche_wordmark.svg" },
  { label: "Mazda", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/4/43/Mazda_logo_2024_%28vertical%29.svg" },
  { label: "BYD", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/9/99/BYD_Company%2C_Ltd._-_Logo.svg" },
  { label: "Geely", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/d/d4/Geely_logo.svg" },
  { label: "Chery", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/b/b6/Chery_logo.svg" },
  { label: "Great Wall", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/e/e6/Great_Wall_Motor_2025_logo.png" },
  { label: "Haval", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/d/da/Haval_2023_logo.svg" },
  { label: "Changan", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/0/00/Changan_icon.svg" },
  { label: "XPeng", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/c/ca/XPeng_logo.svg" },
  { label: "NIO", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/c/ca/NIO_logo.svg" },
  { label: "Li Auto", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/9/93/Li_Auto_logo.svg" },
  { label: "Hongqi", logoSrc: "https://upload.wikimedia.org/wikipedia/en/7/7a/Hongqi_logo.svg" },
  { label: "Jetour", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/a/a0/Jetour_logo.svg" },
  { label: "GAC", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/b/b4/GAC_Gonow_logo.png" },
  { label: "Lynk & Co", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/9/95/Lynk_%26_Co_2016_logo.svg" },
  { label: "Lexus", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/b/b7/Lexus_Logo.svg" },
  { label: "MG", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/c/c8/MG_Motor_2021_logo.svg" },
  { label: "Mitsubishi", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/1/1f/Mitsubishi_Motors_SVG_logo.svg" },
  { label: "Land Rover", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/c/c2/Land_Rover_2023.svg" },
];

function LogoBadge({ brand }: { brand: BrandCell }) {
  return (
    <div className="group flex min-w-0 max-w-full flex-col items-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200/95 bg-white p-1 shadow-sm ring-1 ring-black/[0.05] transition group-hover:border-[var(--brand)]/50 group-hover:ring-[var(--brand)]/15 sm:h-14 sm:w-14 sm:p-1.5 dark:border-slate-500/35 dark:bg-white dark:ring-white/15">
        <Image
          src={brand.logoSrc}
          alt={`${brand.label} logo`}
          width={40}
          height={40}
          unoptimized
          className="h-6 w-auto max-h-6 object-contain sm:h-7 sm:max-h-7"
        />
      </div>
      <span className="mt-1.5 line-clamp-2 w-full max-w-[5.5rem] px-0.5 text-[10px] font-semibold leading-tight text-foreground sm:max-w-[6rem] sm:text-xs">
        {brand.label}
      </span>
    </div>
  );
}

const PAGE_SIZE = 6;
const HOLD_MS = 3200;

function chunkBrands(brands: BrandCell[], size: number): BrandCell[][] {
  const pages: BrandCell[][] = [];
  for (let i = 0; i < brands.length; i += size) {
    pages.push(brands.slice(i, i + size));
  }
  return pages;
}

function PartnerBrandSlideshow({ brands }: { brands: BrandCell[] }) {
  const pages = useMemo(() => chunkBrands(brands, PAGE_SIZE), [brands]);
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduceMotion || paused || pages.length < 2) return;
    const id = window.setInterval(() => {
      setPage((current) => (current + 1) % pages.length);
    }, HOLD_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion, paused, pages.length]);

  if (reduceMotion) {
    return (
      <div
        className="mx-auto grid w-full max-w-6xl grid-cols-3 justify-items-center gap-x-2 gap-y-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
        aria-label="Sourcing and partner marques"
      >
        {brands.map((brand) => (
          <div key={brand.label} className="flex min-w-0 items-center justify-center">
            <LogoBadge brand={brand} />
          </div>
        ))}
      </div>
    );
  }

  const current = pages[page] ?? [];

  return (
    <div
      className="mx-auto w-full max-w-3xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative min-h-[9.25rem] sm:min-h-[7.5rem]" aria-live="polite" aria-atomic="true">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.map((brand) => brand.label).join("|")}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-wrap items-start justify-center gap-x-4 gap-y-4 sm:gap-x-8"
            aria-label="Sourcing and partner marques"
          >
            {current.map((brand) => (
              <div key={brand.label} className="flex w-[30%] min-w-0 items-center justify-center sm:w-24">
                <LogoBadge brand={brand} />
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5" role="tablist" aria-label="Marque groups">
        {pages.map((group, index) => {
          const start = index * PAGE_SIZE + 1;
          const end = start + group.length - 1;
          const active = index === page;
          return (
            <button
              key={group[0]?.label ?? index}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`Show marques ${start} to ${end}`}
              onClick={() => setPage(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                active ? "w-5 bg-[var(--brand)]" : "w-1.5 bg-foreground/25 hover:bg-foreground/45"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

export function PartnerBrandStrip() {
  return (
    <div className="border-t border-border bg-muted/35 px-3 py-6 sm:px-5 dark:border-white/[0.07] dark:bg-black/25">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="rounded-2xl border border-[var(--brand)]/25 bg-gradient-to-r from-[var(--brand)]/[0.13] via-[var(--brand)]/[0.08] to-[var(--brand)]/[0.13] px-4 py-4">
          <p className="text-center text-[10px] font-semibold tracking-[0.28em] text-foreground uppercase sm:text-[11px]">
            Sourcing Country
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {COUNTRY_FLAGS.map((c) => (
              <span
                key={c.label}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--brand)]/35 bg-card/80 px-2.5 py-1.5 text-[10px] font-semibold tracking-wide text-foreground uppercase"
              >
                <span className="text-base leading-none" role="img" aria-label={c.label}>
                  {c.flag}
                </span>
                {c.label}
              </span>
            ))}
          </div>
        </div>
        <PartnerBrandSlideshow brands={DASHBOARD_PARTNER_BRANDS} />
      </div>
    </div>
  );
}
