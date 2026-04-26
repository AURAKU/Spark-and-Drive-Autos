"use client";

export function RequiredLegalCheckbox({
  checked,
  onChange,
  label,
  version,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  version?: string | null;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer gap-2 rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm leading-snug text-foreground dark:border-white/15 dark:bg-white/[0.05] dark:text-zinc-100">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-1 accent-[var(--brand)]"
      />
      <span className="font-medium">
        <span className="rounded-md bg-[var(--brand)]/12 px-1.5 py-0.5 text-[var(--brand)] dark:bg-[var(--brand)]/20">
          {label}
        </span>{" "}
        {version ? <span className="font-mono text-xs text-foreground/80 dark:text-zinc-200/90">(v{version})</span> : null}
      </span>
    </label>
  );
}
