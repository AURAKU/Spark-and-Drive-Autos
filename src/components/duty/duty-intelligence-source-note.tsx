import { DUTY_INTELLIGENCE_SOURCE_NOTE } from "@/lib/duty/disclaimer";

/** Replaces external government reference links — platform is the authoritative planning source. */
export function DutyIntelligenceSourceNote({ compact }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? "rounded-xl border border-border/70 bg-muted/30 p-3 dark:border-white/10 dark:bg-white/[0.03]"
          : "rounded-xl border border-border/70 bg-muted/30 p-4 dark:border-white/10 dark:bg-white/[0.03]"
      }
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Spark &amp; Drive Duty Intelligence
      </p>
      <p className={`mt-1.5 leading-relaxed text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}>
        {DUTY_INTELLIGENCE_SOURCE_NOTE}
      </p>
      <ul className={`mt-2 space-y-1 text-muted-foreground ${compact ? "text-[11px]" : "text-xs"}`}>
        <li>· Configurable customs duty, VAT, NHIL, levies, and fees</li>
        <li>· Auto freight, insurance, port, and clearing charges</li>
        <li>· Historical import learning and confidence scoring</li>
      </ul>
    </div>
  );
}
