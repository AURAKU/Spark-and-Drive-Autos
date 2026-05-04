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
import { UploadedFilePreview } from "@/components/uploads/uploaded-file-preview";
import {
  ALLOWED_VERIFICATION_DOCUMENT_TYPES,
  ID_VERIFICATION_CONSENT_TEXT,
} from "@/lib/identity-verification-shared";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"];

/** Sign APIs may return camelCase or snake_case — normalize for Cloudinary FormData (always `api_key`). */
function pickClientUploadSign(data: Record<string, unknown>): {
  apiKey: string;
  cloudName: string;
  timestamp: number;
  signature: string;
  folder: string;
  uploadUrl: string;
  eager: string | null;
} {
  const apiKey = String(data.apiKey ?? data.api_key ?? "");
  const cloudName = String(data.cloudName ?? data.cloud_name ?? "");
  const signature = String(data.signature ?? "");
  const folder = String(data.folder ?? "");
  const timestamp = Number(data.timestamp);
  let uploadUrl = typeof data.uploadUrl === "string" ? data.uploadUrl.trim() : "";
  if (!uploadUrl && cloudName) {
    uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
  }
  const eagerRaw = data.eager;
  const eager =
    eagerRaw === null || eagerRaw === undefined || eagerRaw === ""
      ? null
      : String(eagerRaw);
  return { apiKey, cloudName, timestamp, signature, folder, uploadUrl, eager };
}

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
  let sigRaw: Record<string, unknown> = {};
  try {
    sigRaw = (await sigRes.json()) as Record<string, unknown>;
  } catch {
    sigRaw = {};
  }
  console.log("SIGN RESPONSE:", sigRaw);
  if (!sigRes.ok) {
    throw new Error("Signing request failed");
  }

  const sig = pickClientUploadSign(sigRaw);
  if (!sig.apiKey || !sig.signature || !Number.isFinite(sig.timestamp) || !sig.folder || !sig.uploadUrl) {
    throw new Error("Signing request failed");
  }

  const fd = new FormData();
  fd.append("file", file);
  fd.append("api_key", sig.apiKey);
  fd.append("timestamp", String(sig.timestamp));
  fd.append("signature", sig.signature);
  fd.append("folder", sig.folder);
  if (sig.eager) fd.append("eager", sig.eager);

  const cloudinaryResponse = await fetch(sig.uploadUrl, { method: "POST", body: fd });
  console.log("UPLOAD STATUS:", cloudinaryResponse.status);
  let cloudinaryResponseData: unknown;
  try {
    cloudinaryResponseData = await cloudinaryResponse.json();
  } catch {
    cloudinaryResponseData = null;
  }
  console.log("UPLOAD RESULT:", cloudinaryResponseData);

  if (!cloudinaryResponse.ok) {
    throw new Error("Cloudinary upload failed");
  }
  const upData = cloudinaryResponseData as { secure_url?: string };
  if (!upData?.secure_url) {
    throw new Error("Cloudinary upload failed");
  }
  return upData.secure_url;
}

function documentTypeLabel(type: VerificationDocumentType): string {
  if (type === VerificationDocumentType.GHANA_CARD) return "Ghana Card";
  if (type === VerificationDocumentType.DRIVER_LICENSE) return "Driver License";
  if (type === VerificationDocumentType.PASSPORT) return "Passport";
  return type.replaceAll("_", " ");
}

export function VerificationClient({
  ghanaCardIdNumber = null,
  ghanaCardImageUrl = null,
  ghanaCardExpiresAt = null,
  ghanaCardVerificationStatus = GhanaCardVerificationStatus.NONE,
  ghanaCardPendingIdNumber = null,
  ghanaCardPendingImageUrl = null,
  ghanaCardPendingExpiresAt = null,
  ghanaCardAiSuggestedNumber = null,
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
  const [documentType, setDocumentType] = useState<VerificationDocumentType>("GHANA_CARD");
  const [reason, setReason] = useState("High-value transaction verification");
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  const canResubmit = !latest || latest.status === "REJECTED" || latest.status === "EXPIRED";
  const uploadDisabled = submitting || !canResubmit;

  const statusMessage = useMemo(() => {
    if (ghanaCardVerificationStatus === GhanaCardVerificationStatus.PENDING_REVIEW) return "Your upload is under admin review.";
    if (ghanaCardVerificationStatus === GhanaCardVerificationStatus.EXPIRED)
      return "Your approved ID has expired. Please upload a new one for review.";
    if (ghanaCardVerificationStatus === GhanaCardVerificationStatus.REJECTED)
      return ghanaCardRejectedReason ?? "Your upload was not approved. Please submit a clearer image.";
    if (ghanaCardVerificationStatus === GhanaCardVerificationStatus.APPROVED) {
      return ghanaCardExpiresAt
        ? `Approved. Expires ${new Date(ghanaCardExpiresAt).toLocaleDateString()}.`
        : "Approved and active.";
    }
    return "No Ghana Card uploaded yet.";
  }, [ghanaCardVerificationStatus, ghanaCardRejectedReason, ghanaCardExpiresAt]);

  async function uploadGhanaCard(file: File) {
    const allowedMime = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"]);
    const mime = (file.type || "").toLowerCase() || "application/octet-stream";
    if (!allowedMime.has(mime)) {
      throw new Error("Use a JPG, PNG, WebP, or PDF file for your Ghana Card.");
    }

    const sigRes = await fetch("/api/uploads/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose: "ghana-card", mimeType: mime }),
    });
    let sigBody: Record<string, unknown> = {};
    try {
      sigBody = (await sigRes.json()) as Record<string, unknown>;
    } catch {
      sigBody = {};
    }
    console.log("SIGN RESPONSE:", sigBody);
    if (!sigRes.ok) {
      throw new Error("Signing request failed");
    }

    const sig = pickClientUploadSign(sigBody);
    if (!sig.apiKey || !sig.signature || !Number.isFinite(sig.timestamp) || !sig.folder || !sig.uploadUrl) {
      throw new Error("Signing request failed");
    }

    const fd = new FormData();
    fd.append("file", file);
    fd.append("api_key", sig.apiKey);
    fd.append("timestamp", String(sig.timestamp));
    fd.append("signature", sig.signature);
    fd.append("folder", sig.folder);

    const cloudinaryResponse = await fetch(sig.uploadUrl, { method: "POST", body: fd });
    console.log("UPLOAD STATUS:", cloudinaryResponse.status);
    let cloudinaryResponseData: unknown;
    try {
      cloudinaryResponseData = await cloudinaryResponse.json();
    } catch {
      cloudinaryResponseData = null;
    }
    console.log("UPLOAD RESULT:", cloudinaryResponseData);

    if (!cloudinaryResponse.ok) {
      throw new Error("Cloudinary upload failed");
    }
    const json = cloudinaryResponseData as { secure_url?: string; public_id?: string };
    if (!json?.secure_url) {
      throw new Error("Cloudinary upload failed");
    }
    const publicId = json.public_id?.trim() || "";
    if (!publicId) {
      throw new Error("Cloudinary upload failed");
    }

    if (!ghanaCardId.trim()) throw new Error("Ghana Card ID number is required.");
    if (!expiryDate) throw new Error("ID expiry date is required.");

    const saveResponse = await fetch("/api/profile/ghana-card", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ghanaCardIdNumber: ghanaCardId,
        imageUrl: json.secure_url,
        imagePublicId: publicId,
        expiryDate,
      }),
    });
    console.log("SAVE STATUS:", saveResponse.status);
    const data = (await saveResponse.json().catch(() => ({}))) as { error?: string; aiSuggested?: string | null };
    if (!saveResponse.ok) {
      const msg =
        typeof data.error === "string" && data.error.trim()
          ? data.error.trim()
          : `Verification save failed (${saveResponse.status})`;
      throw new Error(msg);
    }
    return data;
  }

  async function onUploadCard(file: File | null) {
    if (!file) return;
    setCardUploading(true);
    try {
      await uploadGhanaCard(file);
      toast.success("ID uploaded successfully. Stored temporarily pending admin approval.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setCardUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) return toast.error("Consent is required.");
    if (!front) return toast.error("Upload document front image.");
    if (!back) return toast.error("Upload document back image.");
    if (!selfie) return toast.error("Upload selfie with document.");

    const files = [front, back, selfie].filter(Boolean) as File[];
    for (const f of files) {
      if (!IMAGE_MIME.includes(f.type) || f.size > MAX_IMAGE_BYTES) {
        return toast.error("Use JPG/PNG/WebP under 10MB for all verification files.");
      }
    }

    setSubmitting(true);
    try {
      const frontUrl = await uploadOne(front, "front");
      const backUrl = await uploadOne(back, "back");
      const selfieUrl = await uploadOne(selfie, "selfie");

      const res = await fetch("/api/verification/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType,
          reason: reason.trim(),
          documentFrontUrl: frontUrl,
          documentBackUrl: backUrl,
          selfieUrl,
          consentAccepted: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not submit verification.");
      toast.success("Verification submitted successfully.");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const shownImage = ghanaCardPendingImageUrl ?? ghanaCardImageUrl;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-white">Ghana Card verification</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Upload or take a photo directly. Your upload is stored temporarily for review, then saved permanently after admin approval.
        </p>

        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-zinc-200">{statusMessage}</div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
          <div className="space-y-3">
            <div>
              <Label htmlFor="verification-gh-card-id">Ghana Card ID number</Label>
              <Input
                id="verification-gh-card-id"
                value={ghanaCardId}
                onChange={(e) => setGhanaCardId(e.target.value)}
                className="mt-1"
                placeholder="e.g. GHA-123456789-0"
                disabled={cardUploading}
              />
            </div>
            <div>
              <Label htmlFor="verification-gh-card-expiry">ID expiry date (required)</Label>
              <Input
                id="verification-gh-card-expiry"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="mt-1"
                disabled={cardUploading}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <label className={`inline-flex h-9 cursor-pointer items-center rounded-md border border-white/15 px-4 text-sm text-zinc-200 hover:bg-white/10 ${cardUploading ? "pointer-events-none opacity-50" : ""}`}>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf,.pdf"
                  className="hidden"
                  disabled={cardUploading}
                  onChange={(e) => void onUploadCard(e.target.files?.[0] ?? null)}
                />
                {cardUploading ? "Uploading…" : "Upload ID photo"}
              </label>
              <label className={`inline-flex h-9 cursor-pointer items-center rounded-md border border-white/15 px-4 text-sm text-zinc-200 hover:bg-white/10 ${cardUploading ? "pointer-events-none opacity-50" : ""}`}>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  disabled={cardUploading}
                  onChange={(e) => void onUploadCard(e.target.files?.[0] ?? null)}
                />
                {cardUploading ? "Uploading…" : "Take photo"}
              </label>
            </div>
            {ghanaCardAiSuggestedNumber ? (
              <p className="text-xs text-zinc-500">AI suggestion: <span className="font-mono text-zinc-300">{ghanaCardAiSuggestedNumber}</span></p>
            ) : null}
          </div>

          <div className="min-w-0 max-w-full sm:max-w-[320px]">
            {shownImage ? (
              <UploadedFilePreview
                url={shownImage}
                label="Ghana Card on file"
                statusLabel={ghanaCardVerificationStatus.replaceAll("_", " ")}
                variant="default"
                density="compact"
              />
            ) : (
              <div className="flex min-h-[140px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-xs text-zinc-500">
                No ID photo yet
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-white">Identity verification status</h2>
        <p className="mt-1 text-sm text-zinc-400">Identity verification helps protect customers, prevent fraud, and secure checkout flows.</p>
        <p className="mt-3 text-sm font-semibold text-zinc-200">Current status: {latest?.status ?? "NOT_REQUIRED"}</p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h3 className="text-base font-semibold text-white">Submit / resubmit verification</h3>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label className="text-xs text-zinc-500">Document type</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as VerificationDocumentType)}
              disabled={uploadDisabled}
              className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
            >
              {ALLOWED_VERIFICATION_DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>{documentTypeLabel(t)}</option>
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
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadDisabled} onChange={(e) => setFront(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs text-zinc-400" />
            </label>
            <label className="text-sm text-zinc-300">
              Document back (required)
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadDisabled} onChange={(e) => setBack(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs text-zinc-400" />
            </label>
            <label className="text-sm text-zinc-300 sm:col-span-2">
              Selfie with document (required)
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadDisabled} onChange={(e) => setSelfie(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs text-zinc-400" />
            </label>
          </div>
          <label className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-zinc-300">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={uploadDisabled} className="mt-0.5 accent-[var(--brand)]" />
            <span>{ID_VERIFICATION_CONSENT_TEXT}</span>
          </label>
          <button type="submit" disabled={uploadDisabled} className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black disabled:opacity-50">
            {submitting ? "Submitting…" : "Submit verification"}
          </button>
        </form>
      </section>
    </div>
  );
}
