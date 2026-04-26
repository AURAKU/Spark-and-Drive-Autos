import Image from "next/image";

/**
 * Dashboard partner marques: 26 total, 13 per row on 2xl+.
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

function PartnerBrandGrid({ brands }: { brands: BrandCell[] }) {
  return (
    <div
      className="mx-auto grid w-full max-w-6xl grid-cols-3 justify-items-stretch gap-x-1.5 gap-y-3 sm:grid-cols-4 sm:gap-x-2 sm:gap-y-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-[repeat(13,minmax(0,1fr))]"
      aria-label="Sourcing and partner marques, thirteen per row on wide screens (twenty-six total)"
    >
      {brands.map((brand) => (
        <div key={brand.label} className="flex min-w-0 items-center justify-center">
          <LogoBadge brand={brand} />
        </div>
      ))}
    </div>
  );
}

export function PartnerBrandStrip() {
  return (
    <div className="border-t border-border bg-muted/35 px-3 py-6 sm:px-5 dark:border-white/[0.07] dark:bg-black/25">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="rounded-2xl border border-[var(--brand)]/25 bg-gradient-to-r from-[var(--brand)]/[0.13] via-[var(--brand)]/[0.08] to-[var(--brand)]/[0.13] px-4 py-4">
          <p className="text-center text-[10px] font-semibold tracking-[0.28em] text-foreground uppercase sm:text-[11px]">
            Sourcing Country - Japan - Korea - China - USA - Canada - UAE - Ghana
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
        <PartnerBrandGrid brands={DASHBOARD_PARTNER_BRANDS} />
      </div>
    </div>
  );
}
