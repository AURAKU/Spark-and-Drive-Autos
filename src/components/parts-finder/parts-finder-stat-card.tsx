type PartsFinderStatCardProps = {
  label: string;
  value: string | number;
  suffix?: string;
  hint?: string;
};

export function PartsFinderStatCard({ label, value, suffix, hint }: PartsFinderStatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4 dark:bg-white/[0.03]">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">
        {value}
        {suffix ?? ""}
      </p>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
