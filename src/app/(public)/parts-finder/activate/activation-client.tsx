"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AccessState =
  | "UPSELL_ONLY"
  | "UNAUTHENTICATED"
  | "INACTIVE"
  | "PENDING_PAYMENT"
  | "PENDING_APPROVAL"
  | "ACTIVE"
  | "EXPIRED"
  | "SUSPENDED";

export function PartsFinderActivationClient(props: {
  initialReference?: string;
  accessState: AccessState;
  currency: string;
  activationPriceMinor: number;
  renewalPriceMinor: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "activate" | "renew" | "verify">(null);
  const [reference, setReference] = useState(props.initialReference ?? "");
  const [message, setMessage] = useState<string | null>(null);

  const activationPrice = (props.activationPriceMinor / 100).toFixed(2);
  const renewalPrice = (props.renewalPriceMinor / 100).toFixed(2);

  async function startFlow(endpoint: "/api/parts-finder/activate" | "/api/parts-finder/renew", mode: "activate" | "renew") {
    setBusy(mode);
    setMessage(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; authorizationUrl?: string };
      if (!res.ok || !data.authorizationUrl) {
        setMessage(data.error ?? "Could not initialize payment.");
        return;
      }
      window.location.href = data.authorizationUrl;
    } finally {
      setBusy(null);
    }
  }

  async function verifyPayment() {
    const cleanReference = reference.trim();
    if (!cleanReference) {
      setMessage("Enter a payment reference before verification.");
      return;
    }
    setBusy("verify");
    setMessage(null);
    try {
      const res = await fetch("/api/parts-finder/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerReference: cleanReference }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        payment?: { status?: string };
        membershipState?: "PENDING_PAYMENT" | "ACTIVE";
      };
      if (!res.ok) {
        setMessage(data.error ?? "Verification failed.");
        return;
      }
      if (data.payment?.status !== "SUCCESS") {
        setMessage("Payment not yet marked successful. Please wait for provider confirmation and try again.");
        return;
      }
      setMessage("Payment verified and membership updated.");
      router.push("/parts-finder/search");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
      <p className="text-muted-foreground">
        Activation fee: <span className="font-semibold text-foreground">{activationPrice} {props.currency}</span>
        {" · "}
        Renewal fee: <span className="font-semibold text-foreground">{renewalPrice} {props.currency}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => startFlow("/api/parts-finder/activate", "activate")}
          disabled={
            busy !== null || props.accessState === "PENDING_PAYMENT" || props.accessState === "SUSPENDED"
          }
          className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-70"
        >
          {busy === "activate" ? "Starting activation..." : "Pay & activate (30 days)"}
        </button>
        <button
          type="button"
          onClick={() => startFlow("/api/parts-finder/renew", "renew")}
          disabled={busy !== null || props.accessState === "INACTIVE" || props.accessState === "PENDING_PAYMENT"}
          className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted/50 disabled:opacity-60"
        >
          {busy === "renew" ? "Starting renewal..." : "Pay & renew"}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Payment reference (e.g. SDA-PF-...)"
          className="h-10 min-w-[18rem] rounded-lg border border-border bg-background px-3 text-sm"
        />
        <button
          type="button"
          onClick={verifyPayment}
          disabled={busy !== null}
          className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50 disabled:opacity-60"
        >
          {busy === "verify" ? "Verifying..." : "Verify payment"}
        </button>
      </div>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
