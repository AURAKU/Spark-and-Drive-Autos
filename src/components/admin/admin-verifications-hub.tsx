"use client";

import { VerificationDocumentType, VerificationStatus } from "@prisma/client";
import { useState } from "react";
import { toast } from "sonner";

import { UploadedFilePreview } from "@/components/uploads/uploaded-file-preview";

type Row = {
  id: string;
  userId: string;
  status: VerificationStatus;
  documentType: VerificationDocumentType;
  reason: string | null;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  user: { email: string; name: string | null };
};

export function AdminVerificationsHub({ rows }: { rows: Row[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function review(
    verificationId: string,
    action: "approve" | "reject" | "under_review" | "expire",
  ) {
    const rejectionReason =
      action === "reject" ? window.prompt("Enter rejection reason (required):", "Document is unclear or incomplete.") ?? "" : "";
    if (action === "reject" && rejectionReason.trim().length < 4) {
      toast.error("Rejection reason is required.");
      return;
    }
    const internalNotes = window.prompt("Internal admin note (optional):", "") ?? "";
    setBusyId(verificationId);
    try {
      const res = await fetch(`/api/admin/verifications/${verificationId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          rejectionReason: rejectionReason.trim() || undefined,
          internalNotes: internalNotes.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not update verification.");
      toast.success(`Verification ${action.replace("_", " ")} successful.`);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update verification.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">No verification records found for current filters.</p>
      ) : null}
      {rows.map((row) => (
        <section key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">
                {row.user.name ?? "Customer"} · {row.user.email}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {row.documentType.replaceAll("_", " ")} · submitted {new Date(row.submittedAt).toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-zinc-300">Status: {row.status}</p>
              {row.reason ? <p className="mt-1 text-xs text-zinc-400">Reason: {row.reason}</p> : null}
              {row.rejectionReason ? <p className="mt-1 text-xs text-red-300">Rejection: {row.rejectionReason}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <a className="rounded-md border border-white/15 px-2 py-1 text-xs text-zinc-200 hover:bg-white/10" href={`/api/admin/verifications/${row.id}/document?kind=front`} target="_blank" rel="noreferrer">
                View front (tab)
              </a>
              <a className="rounded-md border border-white/15 px-2 py-1 text-xs text-zinc-200 hover:bg-white/10" href={`/api/admin/verifications/${row.id}/document?kind=back`} target="_blank" rel="noreferrer">
                View back (tab)
              </a>
              <a className="rounded-md border border-white/15 px-2 py-1 text-xs text-zinc-200 hover:bg-white/10" href={`/api/admin/verifications/${row.id}/document?kind=selfie`} target="_blank" rel="noreferrer">
                View selfie (tab)
              </a>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <UploadedFilePreview
              url={`/api/admin/verifications/${row.id}/document?kind=front`}
              label="Document front"
              variant="admin"
              allowCopyUrl
            />
            <UploadedFilePreview
              url={`/api/admin/verifications/${row.id}/document?kind=back`}
              label="Document back"
              variant="admin"
              allowCopyUrl
            />
            <UploadedFilePreview
              url={`/api/admin/verifications/${row.id}/document?kind=selfie`}
              label="Selfie with document"
              variant="admin"
              allowCopyUrl
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={busyId === row.id} onClick={() => void review(row.id, "approve")} className="rounded-md bg-emerald-500/90 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50">Approve</button>
            <button disabled={busyId === row.id} onClick={() => void review(row.id, "reject")} className="rounded-md bg-red-500/90 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50">Reject</button>
            <button disabled={busyId === row.id} onClick={() => void review(row.id, "under_review")} className="rounded-md bg-amber-400/90 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50">Mark under review</button>
            <button disabled={busyId === row.id} onClick={() => void review(row.id, "expire")} className="rounded-md bg-zinc-300 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50">Expire</button>
          </div>
        </section>
      ))}
    </div>
  );
}
