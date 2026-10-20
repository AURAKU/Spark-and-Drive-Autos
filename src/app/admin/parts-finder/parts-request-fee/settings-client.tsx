"use client";

import { useState } from "react";

export function PartsRequestFeeSettingsClient(props: { initial: { enabled: boolean; feeAmount: number } }) {
  const [form, setForm] = useState(props.initial);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSave() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/parts-request-fee", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setBusy(false);
    setMessage(data.ok ? "Saved." : data.error ?? "Save failed.");
  }

  return (
    <div className="max-w-md rounded-xl border border-border bg-card p-4">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />
        Accept paid requests
      </label>
      <label className="mt-4 block text-xs font-medium">Fee in GHS</label>
      <input
        type="number"
        min={1}
        step="0.01"
        value={form.feeAmount}
        onChange={(event) => setForm((current) => ({ ...current, feeAmount: Number(event.target.value || 0) }))}
        className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3"
      />
      <button
        type="button"
        onClick={() => void onSave()}
        disabled={busy}
        className="mt-4 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-black disabled:opacity-60"
      >
        {busy ? "Saving..." : "Save fee"}
      </button>
      {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
