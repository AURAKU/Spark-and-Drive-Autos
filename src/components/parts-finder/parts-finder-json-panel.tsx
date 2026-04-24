type PartsFinderJsonPanelProps = {
  title: string;
  value: unknown;
  className?: string;
};

export function PartsFinderJsonPanel({ title, value, className }: PartsFinderJsonPanelProps) {
  return (
    <section className={`rounded-xl border border-border bg-muted/20 p-4 text-sm dark:bg-white/[0.02] ${className ?? ""}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      <pre className="mt-2 max-h-72 overflow-auto text-xs text-muted-foreground">{JSON.stringify(value, null, 2)}</pre>
    </section>
  );
}
