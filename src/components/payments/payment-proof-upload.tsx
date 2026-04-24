"use client";

import type { PaymentSettlementMethod, PaymentStatus } from "@prisma/client";
import { useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canUploadPaymentProof } from "@/lib/payment-status-utils";
import { getSettlementInstructions } from "@/lib/payment-settlement";

const MAX_PDF_BYTES = 15 * 1024 * 1024;
const IMAGE_COMPRESS_THRESHOLD = 750_000;
const MAX_IMAGE_EDGE = 1920;

async function maybeCompressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= IMAGE_COMPRESS_THRESHOLD) {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > MAX_IMAGE_EDGE || height > MAX_IMAGE_EDGE) {
      if (width >= height) {
        height = Math.round((height * MAX_IMAGE_EDGE) / width);
        width = MAX_IMAGE_EDGE;
      } else {
        width = Math.round((width * MAX_IMAGE_EDGE) / height);
        height = MAX_IMAGE_EDGE;
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82),
    );
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "proof";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function proofKind(file: File): "image" | "pdf" {
  if (file.type === "application/pdf") return "pdf";
  return "image";
}

type UploadSig = {
  timestamp: number;
  signature: string;
  apiKey: string;
  folder: string;
  uploadUrl: string;
  kind: "image" | "pdf";
  eager: string | null;
};

async function uploadProofToCloudinary(file: File, paymentId: string, kind: "image" | "pdf"): Promise<{ url: string; publicId: string }> {
  const sigRes = await fetch("/api/upload/payment-proof-signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentId, kind }),
  });
  if (sigRes.status === 501) throw new Error("Uploads are not configured.");
  if (!sigRes.ok) throw new Error("Could not sign upload");
  const data = (await sigRes.json()) as UploadSig;

  const fd = new FormData();
  fd.append("file", file);
  fd.append("api_key", data.apiKey);
  fd.append("timestamp", String(data.timestamp));
  fd.append("signature", data.signature);
  fd.append("folder", data.folder);
  if (data.eager) {
    fd.append("eager", data.eager);
  }

  const up = await fetch(data.uploadUrl, { method: "POST", body: fd });
  if (!up.ok) {
    const err = await up.text();
    throw new Error(err || "Upload failed");
  }
  const json = (await up.json()) as { secure_url: string; public_id: string };
  return { url: json.secure_url, publicId: json.public_id };
}

export function PaymentProofUpload({
  paymentId,
  status,
  settlementMethod,
}: {
  paymentId: string;
  status: PaymentStatus;
  settlementMethod?: PaymentSettlementMethod;
}) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  if (!canUploadPaymentProof(status)) {
    return (
      <p className="text-sm text-zinc-500">
        Proof upload is closed for this payment (final status).
      </p>
    );
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    e.target.value = "";
    if (!raw) return;

    const kind = proofKind(raw);
    if (kind === "pdf") {
      if (raw.type !== "application/pdf") {
        toast.error("PDF must be a valid application/pdf file.");
        return;
      }
      if (raw.size > MAX_PDF_BYTES) {
        toast.error("PDF must be under 15 MB. Try exporting with lower quality.");
        return;
      }
    } else {
      if (!raw.type.startsWith("image/")) {
        toast.error("Use a photo (JPEG, PNG, WebP) or a PDF.");
        return;
      }
    }

    setLoading(true);
    try {
      const file = kind === "image" ? await maybeCompressImage(raw) : raw;
      const { url, publicId } = await uploadProofToCloudinary(file, paymentId, kind);
      const res = await fetch(`/api/payments/${paymentId}/proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url, publicId, note: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not save proof");
      toast.success(kind === "pdf" ? "PDF attached" : "Proof image attached");
      setNote("");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  const hint =
    settlementMethod && settlementMethod !== "PAYSTACK"
      ? getSettlementInstructions(settlementMethod).lines.join(" ")
      : "Upload a clear photo or PDF of your payment confirmation (bank, Alipay, or office receipt). Large photos are compressed before upload; our team verifies before confirming your purchase.";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h3 className="text-sm font-semibold text-white">Upload payment proof</h3>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
      <div className="mt-4 space-y-3">
        <div>
          <Label htmlFor={`proof-note-${paymentId}`} className="text-zinc-400">
            Note (optional)
          </Label>
          <Input
            id={`proof-note-${paymentId}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Reference / sender name"
            className="mt-1"
          />
        </div>
        <div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            className="hidden"
            id={`proof-file-${paymentId}`}
            disabled={loading}
            onChange={(ev) => void onFile(ev)}
          />
          <label htmlFor={`proof-file-${paymentId}`}>
            <span
              className={`inline-flex h-9 items-center justify-center rounded-md border border-white/10 bg-white/10 px-4 text-sm font-medium text-white ${loading ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-white/15"}`}
            >
              {loading ? "Uploading…" : "Choose image or PDF"}
            </span>
          </label>
          <p className="mt-2 text-[10px] text-zinc-500">
            JPEG, PNG, WebP, GIF, or PDF · images over ~750 KB are resized for faster upload · PDF max 15 MB
          </p>
        </div>
      </div>
    </div>
  );
}
