"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function PaymentDisputePanel({ paymentId, disabled }: { paymentId: string; disabled?: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (loading || disabled) return;
    const message = reason.trim();
    if (message.length < 8) {
      toast.error("Please provide a short reason (at least 8 characters).");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/payments/${encodeURIComponent(paymentId)}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: message }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Could not open dispute.");
        return;
      }
      toast.success("Dispute submitted. Payment moved to legal review.");
      setReason("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/[0.08] p-4">
      <p className="text-sm font-semibold text-red-100">Open payment dispute</p>
      <p className="mt-1 text-xs text-red-100/90">
        If this transaction is incorrect, provide details below. The payment will be placed under review and a dispute trail
        will be created.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="Describe the issue, references, and what outcome you need."
        className="mt-3 w-full rounded-lg border border-white/15 bg-black/30 p-3 text-sm text-white"
        disabled={loading || disabled}
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={loading || disabled}
        className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-red-500 px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? "Submitting..." : "Open dispute"}
      </button>
    </div>
  );
}
