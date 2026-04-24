"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { resolvePartSearchSupportVerification } from "@/actions/parts-finder-admin";

type Row = {
  id: string;
  createdAt: string;
  candidatePartName: string | null;
  confidenceLabel: string;
};

export function PartsFinderSearchReviewQueue({ pending }: { pending: Row[] }) {
  const router = useRouter();
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [busy, startTransition] = useTransition();

  function resolve(id: string, decision: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      const res = await resolvePartSearchSupportVerification(id, decision, notesById[id]);
      if ("error" in res && res.error) toast.error(res.error);
      else {
        toast.success(decision === "APPROVED" ? "Marked reviewed" : "Rejected");
        router.refresh();
      }
    });
  }

  if (pending.length === 0) {
    return <p className="text-sm text-muted-foreground">No pending search-result reviews.</p>;
  }

  return (
    <ul className="space-y-4">
      {pending.map((r) => (
        <li key={r.id} className="rounded-xl border border-border bg-muted/30 p-4 dark:bg-white/[0.02]">
          <p className="font-mono text-xs text-muted-foreground">{r.id}</p>
          <p className="mt-1 text-sm font-medium">{r.candidatePartName ?? "Result"}</p>
          <p className="text-xs text-muted-foreground">
            Label: {r.confidenceLabel.replace(/_/g, " ")} · queued {new Date(r.createdAt).toLocaleString()}
          </p>
          <input
            placeholder="Internal note (optional)"
            value={notesById[r.id] ?? ""}
            onChange={(e) => setNotesById((prev) => ({ ...prev, [r.id]: e.target.value }))}
            className="mt-3 w-full max-w-md rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => resolve(r.id, "APPROVED")}
              className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
            >
              Acknowledge
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => resolve(r.id, "REJECTED")}
              className="rounded-lg border border-red-400/40 px-3 py-1.5 text-xs text-red-200 disabled:opacity-50"
            >
              Flag follow-up
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
