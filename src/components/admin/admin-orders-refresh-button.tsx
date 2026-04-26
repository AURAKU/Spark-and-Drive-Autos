"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminOrdersRefreshButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => {
        setLoading(true);
        router.refresh();
        setTimeout(() => setLoading(false), 400);
      }}
      className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-[var(--brand)]/50 hover:text-white"
    >
      {loading ? "Refreshing…" : "Refresh list"}
    </button>
  );
}
