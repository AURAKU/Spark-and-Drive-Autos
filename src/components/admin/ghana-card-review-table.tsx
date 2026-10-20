"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { UploadedFilePreview } from "@/components/uploads/uploaded-file-preview";
import { Input } from "@/components/ui/input";

export type GhanaCardPendingRow = {
  id: string;
  email: string;
  name: string | null;
  ghanaCardImageUrl: string | null;
  ghanaCardPendingIdNumber: string | null;
  ghanaCardAiSuggestedNumber: string | null;
  ghanaCardPendingExpiresAt: Date | null;
  updatedAt: Date;
};

export type GhanaCardExpiredRow = {
  id: string;
  email: string;
  name: string | null;
  ghanaCardIdNumber: string | null;
  ghanaCardExpiresAt: Date | null;
  ghanaCardImageUrl: string | null;
};

function dateInputValue(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function PendingCard({
  row,
  busy,
  onApprove,
  onReject,
}: {
  row: GhanaCardPendingRow;
  busy: boolean;
  onApprove: (payload: { canonicalIdNumber: string; expiryDate: string }) => void;
  onReject: (reason: string) => void;
}) {
  const [canonical, setCanonical] = useState(row.ghanaCardPendingIdNumber ?? row.ghanaCardAiSuggestedNumber ?? "");
  const [expiryDate, setExpiryDate] = useState(dateInputValue(row.ghanaCardPendingExpiresAt));
  const [rejectReason, setRejectReason] = useState("");

  return (
    <div className="rounded-2xl border border-border dark:border-white/10 bg-muted/30 dark:bg-white/[0.03] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="w-full max-w-xl shrink-0 lg:max-w-[420px]">
          {row.ghanaCardImageUrl ? (
            <UploadedFilePreview
              url={row.ghanaCardImageUrl}
              label="Pending Ghana Card upload"
              uploadedAt={row.updatedAt}
              statusLabel="Pending review"
              variant="admin"
            />
          ) : (
            <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-border dark:border-white/10 bg-black/30 text-xs text-zinc-500">
              No upload
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-medium text-foreground">{row.email}</p>
          {row.name ? <p className="text-sm text-zinc-400">{row.name}</p> : null}
          <p className="text-xs text-zinc-500">AI suggestion: {row.ghanaCardAiSuggestedNumber ?? "—"}</p>

          <label className="block text-xs font-medium text-zinc-500">Canonical ID to store</label>
          <Input
            value={canonical}
            onChange={(e) => setCanonical(e.target.value)}
            disabled={busy}
            className="max-w-md font-mono text-sm"
            placeholder="GHA-..."
          />

          <label className="mt-3 block text-xs font-medium text-zinc-500">Expiry date (required)</label>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            disabled={busy}
            className="h-10 w-full max-w-xs rounded-lg border border-border dark:border-white/10 bg-black/30 px-3 text-sm text-foreground"
          />

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onApprove({ canonicalIdNumber: canonical.trim(), expiryDate })}
              className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy ? "Working…" : "Approve"}
            </button>
          </div>

          <div className="mt-4 border-t border-white/10 pt-4">
            <label className="text-xs font-medium text-zinc-500">Reject with reason</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              disabled={busy}
              rows={2}
              className="mt-1 w-full max-w-md rounded-lg border border-border dark:border-white/10 bg-black/40 px-3 py-2 text-sm text-foreground"
              placeholder="Explain what is wrong with the upload"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => onReject(rejectReason.trim())}
              className="mt-2 inline-flex h-9 items-center rounded-lg border border-red-400/40 bg-red-500/15 px-4 text-sm font-medium text-red-200 hover:bg-red-500/25 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GhanaCardReviewTable({
  pendingRows,
  expiredRows,
}: {
  pendingRows: GhanaCardPendingRow[];
  expiredRows: GhanaCardExpiredRow[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedExpired, setSelectedExpired] = useState<string[]>([]);
  const [resetting, setResetting] = useState(false);
  const [quickFilter, setQuickFilter] = useState<"all" | "pending" | "expired">("all");

  const pendingSorted = useMemo(
    () => [...pendingRows].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    [pendingRows],
  );

  async function approve(userId: string, payload: { canonicalIdNumber: string; expiryDate: string }) {
    if (!payload.canonicalIdNumber.trim()) {
      toast.error("Canonical ID is required.");
      return;
    }
    if (!payload.expiryDate) {
      toast.error("Expiry date is required.");
      return;
    }
    setBusyId(userId);
    try {
      const res = await fetch("/api/admin/ghana-card/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "approve", ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Approve failed.");
      toast.success("Identification approved and saved permanently.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approve failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(userId: string, reason: string) {
    setBusyId(userId);
    try {
      const res = await fetch("/api/admin/ghana-card/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "reject", rejectionReason: reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Reject failed.");
      toast.success("Rejected. User has been notified to try again.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reject failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function resetExpired() {
    if (selectedExpired.length === 0) {
      toast.error("Select at least one expired user.");
      return;
    }
    setResetting(true);
    try {
      const res = await fetch("/api/admin/ghana-card/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selectedExpired }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Reset failed.");
      toast.success("Identification reset completed.");
      setSelectedExpired([]);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setQuickFilter("all")}
          className={`inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium ${quickFilter === "all" ? "bg-[var(--brand)] font-semibold text-black" : "border border-border text-foreground hover:bg-muted dark:border-border dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/10"}`}
        >
          All ({pendingRows.length + expiredRows.length})
        </button>
        <button
          type="button"
          onClick={() => setQuickFilter("pending")}
          className={`inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium ${quickFilter === "pending" ? "bg-amber-400 font-semibold text-black" : "border border-border text-foreground hover:bg-muted dark:border-border dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/10"}`}
        >
          Pending ({pendingRows.length})
        </button>
        <button
          type="button"
          onClick={() => setQuickFilter("expired")}
          className={`inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium ${quickFilter === "expired" ? "bg-red-400 font-semibold text-black" : "border border-border text-foreground hover:bg-muted dark:border-border dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/10"}`}
        >
          Expired ({expiredRows.length})
        </button>
      </div>
      {quickFilter !== "expired" ? (
      <section>
        <h3 className="text-base font-semibold text-foreground">Pending approvals</h3>
        {pendingSorted.length === 0 ? (
          <p className="mt-3 rounded-xl border border-border bg-zinc-100 px-4 py-8 text-center text-sm font-medium text-zinc-800 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-200">
            No pending uploads.
          </p>
        ) : (
          <div className="mt-4 space-y-6">
            {pendingSorted.map((row) => (
              <PendingCard
                key={row.id}
                row={row}
                busy={busyId === row.id}
                onApprove={(payload) => void approve(row.id, payload)}
                onReject={(reason) => void reject(row.id, reason)}
              />
            ))}
          </div>
        )}
      </section>
      ) : null}

      {quickFilter !== "pending" ? (
      <section>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">Expired IDs</h3>
          <button
            type="button"
            disabled={resetting}
            onClick={() => void resetExpired()}
            className="inline-flex h-9 items-center rounded-lg border border-amber-700/40 bg-amber-100 px-4 text-sm font-semibold text-amber-950 hover:bg-amber-200 disabled:opacity-50 dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-100 dark:hover:bg-amber-500/30"
          >
            {resetting ? "Resetting…" : "Reset selected approvals"}
          </button>
        </div>

        {expiredRows.length === 0 ? (
          <p className="mt-3 rounded-xl border border-border bg-zinc-100 px-4 py-8 text-center text-sm font-medium text-zinc-800 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-200">
            No expired approved IDs detected.
          </p>
        ) : (
          <div className="mt-4 sda-table-scroll rounded-xl border border-border dark:border-white/10">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/50 text-foreground/70 dark:bg-white/[0.04] dark:text-zinc-300">
                <tr>
                  <th className="px-3 py-2">Select</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Expired at</th>
                </tr>
              </thead>
              <tbody>
                {expiredRows.map((row) => {
                  const checked = selectedExpired.includes(row.id);
                  return (
                    <tr key={row.id} className="border-t border-border text-foreground dark:border-white/10 dark:text-zinc-200">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedExpired((prev) =>
                              e.target.checked ? [...prev, row.id] : prev.filter((id) => id !== row.id),
                            );
                          }}
                          className="accent-[var(--brand)]"
                        />
                      </td>
                      <td className="px-3 py-2">{row.email}</td>
                      <td className="px-3 py-2 font-mono">{row.ghanaCardIdNumber ?? "—"}</td>
                      <td className="px-3 py-2">
                        {row.ghanaCardExpiresAt ? new Date(row.ghanaCardExpiresAt).toLocaleDateString() : "Unknown"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      ) : null}
    </div>
  );
}
