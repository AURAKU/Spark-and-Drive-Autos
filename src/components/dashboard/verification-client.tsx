"use client";

import { VerificationDocumentType, VerificationStatus } from "@prisma/client";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ID_VERIFICATION_CONSENT_TEXT } from "@/lib/identity-verification";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"];

type UploadSig = {
  timestamp: number;
  signature: string;
  apiKey: string;
  folder: string;
  uploadUrl: string;
  eager: string | null;
};

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

async function uploadOne(file: File, kind: "front" | "back" | "selfie"): Promise<string> {
  const sigRes = await fetch("/api/upload/verification-signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, mimeType: file.type, sizeBytes: file.size }),
  });
  if (!sigRes.ok) {
    const err = await sigRes.json().catch(() => ({}));
    throw new Error(err.error ?? "Could not initialize upload.");
  }
  const sig = (await sigRes.json()) as UploadSig;
  const fd = new FormData();
  fd.append("file", file);
  fd.append("api_key", sig.apiKey);
  fd.append("timestamp", String(sig.timestamp));
  fd.append("signature", sig.signature);
  fd.append("folder", sig.folder);
  if (sig.eager) fd.append("eager", sig.eager);
  const upRes = await fetch(sig.uploadUrl, { method: "POST", body: fd });
  if (!upRes.ok) {
    throw new Error("Document upload failed.");
  }
  const upData = (await upRes.json()) as { secure_url: string };
  return upData.secure_url;
}

function statusTone(status: VerificationStatus) {
  switch (status) {
    case "VERIFIED":
      return "text-emerald-400";
    case "REJECTED":
    case "EXPIRED":
      return "text-red-400";
    case "UNDER_REVIEW":
    case "PENDING":
    case "REQUIRED":
      return "text-amber-300";
    default:
      return "text-zinc-300";
  }
}

export function VerificationClient({
  latest,
}: {
  latest: VerificationSnapshot | null;
}) {
  const [documentType, setDocumentType] = useState<VerificationDocumentType>("GHANA_CARD");
  const [reason, setReason] = useState("High-value transaction verification");
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canResubmit = !latest || latest.status === "REJECTED" || latest.status === "EXPIRED";
  const uploadDisabled = submitting || !canResubmit;
  const statusMessage = useMemo(() => {
    if (!latest) return "No verification submitted yet.";
    if (latest.status === "VERIFIED") return "Your identity is verified for protected payment and compliance flows.";
    if (latest.status === "REJECTED")
      return `Verification rejected. ${latest.rejectionReason ?? "Please upload clearer and valid ID documents."}`;
    if (latest.status === "EXPIRED") return "Verification expired. Submit updated ID documents to continue protected flows.";
    if (latest.status === "UNDER_REVIEW") return "Verification is under review by compliance/admin.";
    return "Verification submitted and pending review.";
  }, [latest]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      toast.error("Consent is required.");
      return;
    }
    if (!front) {
      toast.error("Upload document front image.");
      return;
    }
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 4) {
      toast.error("Provide a clear verification reason (at least 4 characters).");
      return;
    }
    const files = [front, back, selfie].filter(Boolean) as File[];
    for (const f of files) {
      if (!IMAGE_MIME.includes(f.type) || f.size > MAX_IMAGE_BYTES) {
        toast.error("Use JPG/PNG/WebP under 10MB for all verification files.");
        return;
      }
    }
    setSubmitting(true);
    try {
      const frontUrl = await uploadOne(front, "front");
      const backUrl = back ? await uploadOne(back, "back") : undefined;
      const selfieUrl = selfie ? await uploadOne(selfie, "selfie") : undefined;
      const res = await fetch("/api/verification/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType,
          reason: normalizedReason,
          documentFrontUrl: frontUrl,
          documentBackUrl: backUrl,
          selfieUrl,
          consentAccepted: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && data.code === "REQUIRE_ACCEPTANCE") {
          const detail = [data.title, data.version ? `v${data.version}` : null].filter(Boolean).join(" ");
          throw new Error(detail ? `Legal acceptance required: ${detail}.` : "Legal acceptance required before verification.");
        }
        throw new Error(data.error ?? "Could not submit verification.");
      }
      toast.success("Verification submitted successfully.");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-white">Identity verification status</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Identity verification helps us protect customers, prevent fraud, verify payments, and safely process high-value transactions.
        </p>
        <p className={`mt-3 text-sm font-semibold ${latest ? statusTone(latest.status) : "text-zinc-300"}`}>
          Current status: {latest?.status ?? "NOT_REQUIRED"}
        </p>
        <p className="mt-1 text-sm text-zinc-300">{statusMessage}</p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h3 className="text-base font-semibold text-white">Submit / resubmit verification</h3>
        {!canResubmit ? (
          <p className="mt-2 text-sm text-zinc-400">
            Upload is currently locked while your current verification is {latest?.status?.toLowerCase()}.
          </p>
        ) : null}
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label className="text-xs text-zinc-500">Document type</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as VerificationDocumentType)}
              disabled={uploadDisabled}
              className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
            >
              {Object.values(VerificationDocumentType).map((t) => (
                <option key={t} value={t}>
                  {t.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Verification reason</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={uploadDisabled}
              className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-zinc-300">
              Document front (required)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploadDisabled}
                onChange={(e) => setFront(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-xs text-zinc-400"
              />
            </label>
            <label className="text-sm text-zinc-300">
              Document back (optional)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploadDisabled}
                onChange={(e) => setBack(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-xs text-zinc-400"
              />
            </label>
            <label className="text-sm text-zinc-300 sm:col-span-2">
              Selfie with document (optional but recommended)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploadDisabled}
                onChange={(e) => setSelfie(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-xs text-zinc-400"
              />
            </label>
          </div>
          <label className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={uploadDisabled}
              className="mt-0.5 accent-[var(--brand)]"
            />
            <span>{ID_VERIFICATION_CONSENT_TEXT}</span>
          </label>
          <button
            type="submit"
            disabled={uploadDisabled}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit verification"}
          </button>
        </form>
      </section>
    </div>
  );
}
