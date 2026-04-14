import Image from "next/image";

/** Japanese, Korean & Chinese marques — Simple Icons CDN where available; text fallback for others. */
const BRANDS: {
  slug?: string;
  hex?: string;
  label: string;
  sub?: string;
}[] = [
  { slug: "toyota", hex: "EB0A1E", label: "Toyota", sub: "Crown & imports" },
  { slug: "lexus", hex: "FFFFFF", label: "Lexus" },
  { slug: "honda", hex: "E40521", label: "Honda" },
  { slug: "nissan", hex: "C3002F", label: "Nissan" },
  { slug: "hyundai", hex: "002C5F", label: "Hyundai" },
  { slug: "kia", hex: "05141F", label: "Kia" },
  { slug: "genesis", hex: "FFFFFF", label: "Genesis" },
  { slug: "byd", hex: "FFFFFF", label: "BYD" },
  { slug: "geely", hex: "0066B1", label: "Geely" },
  { slug: "xpeng", hex: "FFFFFF", label: "XPeng" },
  { label: "Jetour", sub: "China" },
  { slug: "chery", hex: "E31937", label: "Chery" },
  { label: "Changan", sub: "China" },
];

function iconUrl(slug: string, hex: string) {
  return `https://cdn.simpleicons.org/${slug}/${hex}`;
}

export function PartnerBrandStrip() {
  return (
    <div className="border-t border-border bg-muted/50 px-4 py-3 sm:px-6 dark:border-white/[0.07] dark:bg-black/20">
      <p className="mb-3 text-[10px] font-semibold tracking-[0.25em] text-muted-foreground uppercase">
        Sourcing partners — Japan · Korea · China
      </p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
        {BRANDS.map((b) => (
          <div
            key={b.label}
            className="group flex min-w-[5.5rem] flex-col items-center gap-1.5 text-center sm:min-w-[6rem]"
          >
            <div className="flex h-10 w-full items-center justify-center rounded-lg border border-border bg-card px-2 transition group-hover:border-[var(--brand)]/35 group-hover:bg-muted dark:border-white/10 dark:bg-white/[0.04] dark:group-hover:bg-white/[0.07]">
              {b.slug && b.hex ? (
                <Image
                  src={iconUrl(b.slug, b.hex)}
                  alt=""
                  width={72}
                  height={28}
                  className="h-7 w-auto max-w-[4.5rem] object-contain opacity-90 transition group-hover:opacity-100"
                  unoptimized
                />
              ) : (
                <span className="text-[11px] font-bold tracking-wide text-foreground dark:text-white">{b.label}</span>
              )}
            </div>
            <span className="text-[10px] leading-tight text-muted-foreground">
              {b.sub ? `${b.label} · ${b.sub}` : b.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
