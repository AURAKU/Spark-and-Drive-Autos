"use client";

import {
  GhanaCardVerificationStatus,
  VerificationDocumentType,
  VerificationStatus,
} from "@prisma/client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type VerificationSnapshot = {
  id: string;
  status: VerificationStatus;
  documentType: VerificationDocumentType;
  reason: string | null;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  expiresAt: string | null;
};

export function VerificationClient({
  ghanaCardIdNumber = null,
  ghanaCardImageUrl = null,
  ghanaCardExpiresAt = null,
  ghanaCardVerificationStatus = GhanaCardVerificationStatus.NONE,
  ghanaCardPendingIdNumber = null,
  ghanaCardPendingImageUrl = null,
  ghanaCardPendingExpiresAt = null,
  ghanaCardRejectedReason = null,
  latest,
}: {
  ghanaCardIdNumber?: string | null;
  ghanaCardImageUrl?: string | null;
  ghanaCardExpiresAt?: string | null;
  ghanaCardVerificationStatus?: GhanaCardVerificationStatus;
  ghanaCardPendingIdNumber?: string | null;
  ghanaCardPendingImageUrl?: string | null;
  ghanaCardPendingExpiresAt?: string | null;
  ghanaCardAiSuggestedNumber?: string | null;
  ghanaCardRejectedReason?: string | null;
  latest: VerificationSnapshot | null;
}) {
  const router = useRouter();
  const [ghanaCardId, setGhanaCardId] = useState(ghanaCardPendingIdNumber ?? ghanaCardIdNumber ?? "");
  const [expiryDate, setExpiryDate] = useState(
    ghanaCardPendingExpiresAt ? ghanaCardPendingExpiresAt.slice(0, 10) : ghanaCardExpiresAt ? ghanaCardExpiresAt.slice(0, 10) : "",
  );
  const [cardUploading, setCardUploading] = useState(false);

  useEffect(() => {
    setGhanaCardId(ghanaCardPendingIdNumber ?? ghanaCardIdNumber ?? "");
    setExpiryDate(
      ghanaCardPendingExpiresAt
        ? ghanaCardPendingExpiresAt.slice(0, 10)
        : ghanaCardExpiresAt
          ? ghanaCardExpiresAt.slice(0, 10)
          : "",
    );
  }, [ghanaCardIdNumber, ghanaCardPendingIdNumber, ghanaCardPendingExpiresAt, ghanaCardExpiresAt]);

  const statusMessage = useMemo(() => {
    if (ghanaCardVerificationStatus === GhanaCardVerificationStatus.PENDING_REVIEW)
      return "Your Ghana Card number is saved and waiting for review.";
    if (ghanaCardVerificationStatus === GhanaCardVerificationStatus.EXPIRED)
      return "This expiry date has passed. Please update it.";
    if (ghanaCardVerificationStatus === GhanaCardVerificationStatus.REJECTED)
      return ghanaCardRejectedReason ?? "Please check the number and expiry date, then save again.";
    if (ghanaCardVerificationStatus === GhanaCardVerificationStatus.APPROVED) {
      return ghanaCardExpiresAt
        ? `Saved until ${new Date(ghanaCardExpiresAt).toLocaleDateString()}.`
        : "Saved.";
    }
    return "No Ghana Card number saved yet.";
  }, [ghanaCardVerificationStatus, ghanaCardRejectedReason, ghanaCardExpiresAt]);

  async function saveGhanaCardReference(e: React.FormEvent) {
    e.preventDefault();
    if (!ghanaCardId.trim()) return toast.error("Ghana Card ID number is required.");
    if (!expiryDate) return toast.error("ID expiry date is required.");
    setCardUploading(true);
    try {
      const saveResponse = await fetch("/api/profile/ghana-card", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ghanaCardIdNumber: ghanaCardId,
          expiryDate,
        }),
      });
      const data = (await saveResponse.json().catch(() => ({}))) as { error?: string };
      if (!saveResponse.ok) {
        throw new Error(data.error?.trim() || `Could not save Ghana Card reference (${saveResponse.status})`);
      }
      toast.success("Ghana Card details saved.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setCardUploading(false);
    }
  }

  const legacyCardImage = Boolean(ghanaCardPendingImageUrl || ghanaCardImageUrl);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-white">Ghana Card</h2>
        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-zinc-200">{statusMessage}</div>
        {legacyCardImage ? (
          <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
            Contact support if you need an older file on this account removed.
          </p>
        ) : null}

        <form onSubmit={(e) => void saveGhanaCardReference(e)} className="mt-4 max-w-xl space-y-3">
          <div>
            <Label htmlFor="verification-gh-card-id">Ghana Card number</Label>
            <Input
              id="verification-gh-card-id"
              value={ghanaCardId}
              onChange={(e) => setGhanaCardId(e.target.value)}
              className="mt-1"
              placeholder="e.g. GHA-123456789-0"
              autoComplete="off"
              disabled={cardUploading}
            />
          </div>
          <div>
            <Label htmlFor="verification-gh-card-expiry">Expiry date</Label>
            <Input
              id="verification-gh-card-expiry"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="mt-1"
              disabled={cardUploading}
            />
          </div>
          <button
            type="submit"
            disabled={cardUploading}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black disabled:opacity-50"
          >
            {cardUploading ? "Saving…" : "Save"}
          </button>
        </form>
      </section>

      {latest ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Identity verification status</h2>
          <p className="mt-3 text-sm font-semibold text-zinc-200">Record on file: {latest.status}</p>
        </section>
      ) : null}
    </div>
  );
}
