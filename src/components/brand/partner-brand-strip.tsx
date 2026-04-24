import Image from "next/image";

type BrandCell = {
  label: string;
  logoSlug: string;
  logoSrc?: string;
};

const COUNTRY_FLAGS = [
  { label: "JAPAN", flag: "🇯🇵" },
  { label: "KOREA", flag: "🇰🇷" },
  { label: "CHINA", flag: "🇨🇳" },
  { label: "USA", flag: "🇺🇸" },
  { label: "CANADA", flag: "🇨🇦" },
  { label: "UAE", flag: "🇦🇪" },
  { label: "GHANA", flag: "🇬🇭" },
] as const;

const GLOBAL_BRANDS: BrandCell[] = [
  { label: "Toyota", logoSlug: "toyota" },
  { label: "Honda", logoSlug: "honda" },
  { label: "Nissan", logoSlug: "nissan" },
  { label: "Hyundai", logoSlug: "hyundai" },
  { label: "Kia", logoSlug: "kia" },
  { label: "BMW", logoSlug: "bmw" },
  { label: "Mercedes-Benz", logoSlug: "mercedesbenz", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/9/9e/Mercedes-Benz_%282025%29.svg" },
  { label: "Audi", logoSlug: "audi" },
  { label: "Volkswagen", logoSlug: "volkswagen" },
  { label: "Ford", logoSlug: "ford" },
  { label: "Tesla", logoSlug: "tesla" },
  { label: "Porsche", logoSlug: "porsche" },
];

const CHINESE_BRANDS: BrandCell[] = [
  { label: "BYD", logoSlug: "byd", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/1/18/BYD_Auto_2022_logo.svg" },
  { label: "Geely", logoSlug: "geely", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/5/59/Geely_logo.svg" },
  { label: "Chery", logoSlug: "chery", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/8/86/Chery_Logo.svg" },
  { label: "Great Wall", logoSlug: "greatwall", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/2/2c/Great_Wall_Motor_2025_logo.png" },
  { label: "Haval", logoSlug: "haval", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/f/f0/Haval_2023_logo.svg" },
  { label: "Changan", logoSlug: "changan", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/4/4f/Changan_icon.svg" },
  { label: "XPeng", logoSlug: "xpeng", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/6/64/XPeng_logo.svg" },
  { label: "NIO", logoSlug: "nio", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/5/57/NIO_logo.svg" },
  { label: "Li Auto", logoSlug: "liauto", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/2/22/Li_Auto_logo.svg" },
  { label: "Hongqi", logoSlug: "hongqi", logoSrc: "https://cdn.simpleicons.org/hongqi/111111" },
  { label: "Jetour", logoSlug: "jetour", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/4/40/Jetour_logo.svg" },
  { label: "GAC", logoSlug: "gac", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/f/fd/GAC_GROUP_logo.svg" },
  { label: "Lynk & Co", logoSlug: "lynkco", logoSrc: "https://upload.wikimedia.org/wikipedia/commons/8/84/Lynk_%26_Co_logo.svg" },
];

const ALL_BRANDS_ORDERED = [...GLOBAL_BRANDS, ...CHINESE_BRANDS];

const KNOWN_WORKING = new Set(["toyota", "honda", "nissan", "hyundai", "kia", "bmw", "audi", "volkswagen", "ford", "tesla", "porsche", "xpeng", "nio"]);

function iconUrl(slug: string) {
  return `https://cdn.simpleicons.org/${slug}/111111`;
}

function wordmarkDataUrl(label: string) {
  const safe = label
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="84" viewBox="0 0 140 84"><rect width="140" height="84" rx="42" fill="white"/><text x="70" y="48" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="16" font-weight="700" fill="#111">${safe}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function LogoBadge({ brand }: { brand: BrandCell }) {
  const src = brand.logoSrc ?? (KNOWN_WORKING.has(brand.logoSlug) ? iconUrl(brand.logoSlug) : wordmarkDataUrl(brand.label));
  return (
    <div className="group flex flex-col items-center text-center">
      <div className="flex size-[3.35rem] items-center justify-center rounded-full border border-slate-300 bg-white shadow-sm transition group-hover:border-[var(--brand)]/55 sm:size-[3.55rem]">
        <Image src={src} alt={brand.label} width={34} height={34} className="h-[1.65rem] w-auto object-contain dark:[filter:none]" unoptimized />
      </div>
      <span className="mt-1.5 text-[11px] font-semibold leading-tight text-foreground sm:text-xs">{brand.label}</span>
    </div>
  );
}

function PartnerBrandGrid({ brands }: { brands: BrandCell[] }) {
  const colCount = Math.ceil(brands.length / 2);
  return (
    <div className="overflow-x-auto pb-2">
      <div
        className="grid min-w-[min(100%,66rem)] grid-flow-col auto-cols-fr gap-x-2 gap-y-4 sm:gap-x-3"
        style={{ gridTemplateRows: "repeat(2,minmax(0,auto))", gridTemplateColumns: `repeat(${colCount},minmax(4.5rem,1fr))` }}
      >
        {brands.map((brand) => (
          <div key={brand.label} className="flex min-w-[4.5rem] items-center justify-center">
            <LogoBadge brand={brand} />
          </div>
        ))}
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
        <PartnerBrandGrid brands={ALL_BRANDS_ORDERED} />
      </div>
    </div>
  );
}
