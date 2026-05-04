"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type OrderInquiryRow = {
  id: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  brand: string;
  model: string;
  status: string;
  createdAt: string;
  hasUser: boolean;
};

export function OrderInquiriesClient({ rows }: { rows: OrderInquiryRow[] }) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = rows.length > 0 && allIds.every((id) => selected[id]);
  const selectedCount = allIds.filter((id) => selected[id]).length;

  function toggleAll() {
    if (allSelected) {
      setSelected({});
    } else {
      const next: Record<string, boolean> = {};
      for (const id of allIds) next[id] = true;
      setSelected(next);
    }
  }

  function toggleOne(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  function copySelectedIds() {
    const ids = allIds.filter((id) => selected[id]);
    if (ids.length === 0) return;
    void navigator.clipboard.writeText(ids.join("\n"));
  }

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">No order inquiries yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-400">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="size-4 rounded border-white/20 bg-black/40"
          />
          <span>Select all ({rows.length})</span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-zinc-500">{selectedCount} selected</span>
          <button
            type="button"
            onClick={copySelectedIds}
            disabled={selectedCount === 0}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5 disabled:opacity-40"
          >
            Copy selected IDs
          </button>
        </div>
      </div>

      <div className="sda-table-scroll rounded-2xl border border-white/10">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="w-10 px-3 py-3" />
              <th className="px-3 py-3">Vehicle</th>
              <th className="px-3 py-3">Contact</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Submitted</th>
              <th className="px-3 py-3">Account</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/[0.02]">
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={Boolean(selected[r.id])}
                    onChange={() => toggleOne(r.id)}
                    className="size-4 rounded border-white/20 bg-black/40"
                  />
                </td>
                <td className="px-3 py-3 text-white">
                  {r.brand} {r.model}
                </td>
                <td className="max-w-[220px] px-3 py-3 text-zinc-400">
                  <div className="truncate font-medium text-zinc-300">{r.guestName}</div>
                  <div className="truncate text-xs">{r.guestEmail}</div>
                  <div className="truncate text-xs">{r.guestPhone}</div>
                </td>
                <td className="px-3 py-3 text-zinc-400">{r.status}</td>
                <td className="whitespace-nowrap px-3 py-3 text-xs text-zinc-500">
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-3 text-xs text-zinc-500">{r.hasUser ? "Linked" : "Guest"}</td>
                <td className="px-3 py-3">
                  <Link
                    href={`/admin/order-inquiries/${r.id}`}
                    className="text-[var(--brand)] hover:underline"
                  >
                    View summary
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
