"use client";

import type {
  Payment,
  PaymentProof,
  PaymentProofStatus,
  PaymentSettlementMethod,
  PaymentStatus,
  User,
} from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getSettlementInstructions, SETTLEMENT_METHOD_ORDER, settlementMethodLabel } from "@/lib/payment-settlement";
import { PAYMENT_STATUS_ORDER } from "@/lib/payment-status-utils";

type PaymentWithRelations = Payment & {
  proofs: PaymentProof[];
  user: Pick<User, "email" | "name"> | null;
};

export function AdminPaymentPanel({ payment: initial }: { payment: PaymentWithRelations }) {
  const router = useRouter();
  const [payment, setPayment] = useState(initial);
  const [status, setStatus] = useState<PaymentStatus>(payment.status);
  const [settlementMethod, setSettlementMethod] = useState<PaymentSettlementMethod>(payment.settlementMethod);
  const [adminNote, setAdminNote] = useState(payment.adminNote ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setStatus(payment.status);
    setSettlementMethod(payment.settlementMethod);
    setAdminNote(payment.adminNote ?? "");
  }, [payment.id, payment.status, payment.settlementMethod, payment.adminNote]);

  async function savePayment() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payments/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          adminNote: adminNote.trim() || null,
          settlementMethod,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      if (data.payment) setPayment(data.payment);
      toast.success("Payment updated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  async function reviewProof(proofId: string, proofStatus: PaymentProofStatus, proofAdminNote: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payments/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proofId,
          proofStatus,
          proofAdminNote: proofAdminNote.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      if (data.payment) setPayment(data.payment);
      toast.success("Proof updated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <PaymentStatusBadge status={payment.status} />
        <span className="font-mono text-xs text-zinc-500">{payment.providerReference ?? payment.id}</span>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Settlement route (customer-facing)</p>
        <p className="mt-1 text-sm text-white">{settlementMethodLabel(settlementMethod)}</p>
        <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-zinc-400">
          {getSettlementInstructions(settlementMethod).lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="grid gap-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <Label>Settlement method (correct if customer chose wrong)</Label>
            <Select value={settlementMethod} onValueChange={(v) => setSettlementMethod(v as PaymentSettlementMethod)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SETTLEMENT_METHOD_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    {settlementMethodLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Payment status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as PaymentStatus)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="admin-note">Internal / customer-visible note</Label>
            <Textarea
              id="admin-note"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={4}
              className="mt-1"
              placeholder="Shown on the customer payment detail when set."
            />
          </div>
          <Button type="button" disabled={loading} onClick={() => void savePayment()}>
            {loading ? "Saving…" : "Save payment"}
          </Button>
        </div>
        <div className="text-sm text-zinc-400">
          <p>
            <span className="text-zinc-500">Customer:</span> {payment.user?.email ?? "—"}
          </p>
          <p className="mt-2">
            Use status to request proof (<strong className="text-zinc-300">Awaiting proof</strong>) or confirm manually (
            <strong className="text-zinc-300">Success</strong>) when Paystack webhook is delayed. Paystack flow stays
            unchanged.
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white">Payment screenshots</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {payment.proofs.length === 0 ? (
            <p className="text-sm text-zinc-500">No uploads yet.</p>
          ) : (
            payment.proofs.map((proof) => (
              <ProofReviewCard
                key={proof.id}
                proof={proof}
                disabled={loading}
                onApprove={(note) => void reviewProof(proof.id, "APPROVED", note)}
                onReject={(note) => void reviewProof(proof.id, "REJECTED", note)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ProofReviewCard({
  proof,
  disabled,
  onApprove,
  onReject,
}: {
  proof: PaymentProof;
  disabled: boolean;
  onApprove: (note: string) => void;
  onReject: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={proof.imageUrl} alt="Payment proof" className="h-40 w-full object-cover" />
      <div className="space-y-2 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{proof.status}</p>
        {proof.note ? <p className="text-xs text-zinc-400">{proof.note}</p> : null}
        <Input
          placeholder="Note to customer (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="text-xs"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={() => onApprove(note)}
          >
            Approve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onReject(note)}
          >
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}
