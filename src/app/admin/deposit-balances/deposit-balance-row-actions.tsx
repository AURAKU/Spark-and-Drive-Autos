"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { orderId: string; canRemind: boolean };

export function DepositBalanceRowActions({ orderId, canRemind }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function post(path: string, body?: object) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setMsg(j.error ?? "Request failed");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-2">
      {msg ? <p className="text-xs text-amber-200/90">{msg}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const manualReference = window.prompt("Manual payment reference (optional):");
            if (manualReference === null) return;
            const note = window.prompt("Note (optional):");
            if (note === null) return;
            void post(`/api/admin/deposit-balances/${orderId}/mark-paid`, {
              manualReference: manualReference.trim() || undefined,
              note: note.trim() || undefined,
            });
          }}
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
        >
          Mark balance paid
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const note = window.prompt("Append ops note:");
            if (!note?.trim()) return;
            void post(`/api/admin/deposit-balances/${orderId}/note`, { note: note.trim() });
          }}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/5 disabled:opacity-50"
        >
          Add note
        </button>
        {canRemind ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void post(`/api/admin/deposit-balances/${orderId}/send-reminder`)}
            className="rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
          >
            Send reminder
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!window.confirm("Cancel this reservation? Inventory may be released if no other blocking payments.")) {
              return;
            }
            const reason = window.prompt("Reason (optional):");
            if (reason === null) return;
            void post(`/api/admin/deposit-balances/${orderId}/cancel-reservation`, {
              reason: reason.trim() || undefined,
            });
          }}
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-100 hover:bg-red-500/20 disabled:opacity-50"
        >
          Cancel reservation
        </button>
      </div>
    </div>
  );
}
