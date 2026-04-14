/**
 * Visual shorthand for international reach: flags only, no country-name clutter.
 * Styling matches storefront premium dark UI.
 */
const FLAGS = [
  { code: "GH", flag: "🇬🇭", label: "Ghana" },
  { code: "CN", flag: "🇨🇳", label: "China" },
  { code: "KR", flag: "🇰🇷", label: "Korea" },
  { code: "JP", flag: "🇯🇵", label: "Japan" },
  { code: "AE", flag: "🇦🇪", label: "UAE" },
  { code: "US", flag: "🇺🇸", label: "USA" },
  { code: "CA", flag: "🇨🇦", label: "Canada" },
] as const;

type SourcingFlagsProps = {
  /** Tighter chips for the sticky site header. */
  variant?: "default" | "header";
  tone?: "default" | "gear";
  className?: string;
};

export function SourcingFlags({ variant = "default", tone = "default", className = "" }: SourcingFlagsProps) {
  const isHeader = variant === "header";
  const isGear = tone === "gear";
  return (
    <div
      className={`flex flex-wrap items-center ${isHeader ? "gap-1.5 sm:gap-2" : "gap-2 sm:gap-3"} ${className}`}
      aria-label="Sourcing and supply regions"
    >
      {FLAGS.map(({ code, flag, label }) => (
        <span
          key={code}
          title={label}
          className={
            isHeader
              ? `inline-flex size-9 items-center justify-center rounded-lg border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02] text-lg ring-1 ring-[var(--brand)]/20 ${
                  isGear ? "shadow-[0_0_16px_-4px_rgba(239,68,68,0.4)]" : "shadow-[0_0_16px_-4px_rgba(20,216,230,0.3)]"
                } sm:size-10 sm:text-xl`
              : `inline-flex size-11 items-center justify-center rounded-xl border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02] text-xl ring-1 ring-[var(--brand)]/20 transition hover:border-[var(--brand)]/40 ${
                  isGear
                    ? "shadow-[0_0_20px_-4px_rgba(239,68,68,0.45)] hover:shadow-[0_0_28px_-2px_rgba(239,68,68,0.58)]"
                    : "shadow-[0_0_20px_-4px_rgba(20,216,230,0.35)] hover:shadow-[0_0_28px_-2px_rgba(20,216,230,0.45)]"
                } sm:size-12 sm:text-2xl`
          }
        >
          <span className="leading-none">{flag}</span>
          <span className="sr-only">{label}</span>
        </span>
      ))}
    </div>
  );
}
