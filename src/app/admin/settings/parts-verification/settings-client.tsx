"use client";

import { useState } from "react";

export function PartsVerificationSettingsClient(props: {
  initial: {
    enabled: boolean;
    feeAmount: number;
    currency: string;
    serviceDescription: string;
    legalNote: string;
  };
}) {
  const [form, setForm] = useState(props.initial);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSave() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/verified-parts/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setBusy(false);
    setMessage(data.ok ? "Saved." : data.error ?? "Save failed.");
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="grid gap-3">
        <label className="text-xs font-medium">Service enabled</label>
        <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))} />
        <label className="text-xs font-medium">Fee amount</label>
        <input
          value={form.feeAmount}
          onChange={(e) => setForm((p) => ({ ...p, feeAmount: Number(e.target.value || 0) }))}
          className="h-10 rounded-lg border border-border bg-background px-3"
        />
        <label className="text-xs font-medium">Currency</label>
        <input
          value={form.currency}
          onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
          className="h-10 rounded-lg border border-border bg-background px-3"
        />
        <label className="text-xs font-medium">Service description</label>
        <textarea
          value={form.serviceDescription}
          onChange={(e) => setForm((p) => ({ ...p, serviceDescription: e.target.value }))}
          className="min-h-20 rounded-lg border border-border bg-background p-3"
        />
        <label className="text-xs font-medium">Legal note</label>
        <textarea
          value={form.legalNote}
          onChange={(e) => setForm((p) => ({ ...p, legalNote: e.target.value }))}
          className="min-h-20 rounded-lg border border-border bg-background p-3"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="w-fit rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-black disabled:opacity-60"
        >
          {busy ? "Saving..." : "Save settings"}
        </button>
        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      </div>
    </div>
  );
}
