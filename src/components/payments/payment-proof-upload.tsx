"use client";

import type { PaymentSettlementMethod, PaymentStatus } from "@prisma/client";
import { useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canUploadPaymentProof } from "@/lib/payment-status-utils";
import { getSettlementInstructions } from "@/lib/payment-settlement";

async function uploadProofImage(file: File, paymentId: string) {
  const sigRes = await fetch("/api/upload/payment-proof-signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentId }),
  });
  if (sigRes.status === 501) throw new Error("Uploads are not configured.");
  if (!sigRes.ok) throw new Error("Could not sign upload");
  const data = (await sigRes.json()) as {
    timestamp: number;
    signature: string;
    apiKey: string;
    folder: string;
    uploadUrl: string;
  };
  const fd = new FormData();
  fd.append("file", file);
  fd.append("api_key", data.apiKey);
  fd.append("timestamp", String(data.timestamp));
  fd.append("signature", data.signature);
  fd.append("folder", data.folder);
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
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) {
      toast.error("Choose an image file (PNG or JPEG).");
      return;
    }
    setLoading(true);
    try {
      const { url, publicId } = await uploadProofImage(file, paymentId);
      const res = await fetch(`/api/payments/${paymentId}/proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url, publicId, note: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not save proof");
      toast.success("Screenshot attached");
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
      : "Upload a clear screenshot of your receipt (bank, Mobile Money, Alipay, or office receipt). Our team verifies it against your order.";

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
            accept="image/*"
            className="hidden"
            id={`proof-file-${paymentId}`}
            disabled={loading}
            onChange={(ev) => void onFile(ev)}
          />
          <label htmlFor={`proof-file-${paymentId}`}>
            <span
              className={`inline-flex h-9 items-center justify-center rounded-md border border-white/10 bg-white/10 px-4 text-sm font-medium text-white ${loading ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-white/15"}`}
            >
              {loading ? "Uploading…" : "Choose screenshot"}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
