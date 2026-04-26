"use client";

import { useState } from "react";

export function LegalAcceptanceModal({
  title,
  content,
  onAccept,
}: {
  title: string;
  content: string;
  onAccept: () => void;
}) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="legal-content mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{content}</div>
      <label className="mt-4 flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm font-medium text-foreground dark:border-white/15 dark:bg-white/[0.05] dark:text-zinc-100">
        <input type="checkbox" onChange={(e) => setChecked(e.target.checked)} className="accent-[var(--brand)]" />
        I agree
      </label>
      <button
        disabled={!checked}
        onClick={onAccept}
        className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-4 font-semibold text-black disabled:opacity-60"
      >
        Continue
      </button>
    </div>
  );
}
